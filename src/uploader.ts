import { RequestUrlParam, requestUrl } from "obsidian";
import { HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { HttpHandlerOptions } from "@aws-sdk/types";
import { buildQueryString } from "@aws-sdk/querystring-builder";
import { requestTimeout } from "@smithy/fetch-http-handler/dist-es/request-timeout";
import { FetchHttpHandler, FetchHttpHandlerOptions } from "@smithy/fetch-http-handler";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { R2UploaderSettings } from "./settings";

// ── HTTP Handler ──────────────────────────────────────────────────────────────
// Based on AWS SDK FetchHttpHandler (Apache 2.0 License)

export class ObsHttpHandler extends FetchHttpHandler {
	requestTimeoutInMs: number | undefined;
	constructor(options?: FetchHttpHandlerOptions) {
		super(options);
		this.requestTimeoutInMs = options?.requestTimeout;
	}
	async handle(
		request: HttpRequest,
		{ abortSignal }: HttpHandlerOptions = {},
	): Promise<{ response: HttpResponse }> {
		if (abortSignal?.aborted) {
			const err = new Error("Request aborted");
			err.name = "AbortError";
			return Promise.reject(err);
		}

		let path = request.path;
		if (request.query) {
			const qs = buildQueryString(request.query);
			if (qs) path += `?${qs}`;
		}

		const { port, method } = request;
		const url = `${request.protocol}//${request.hostname}${port ? `:${port}` : ""}${path}`;

		const transformedHeaders: Record<string, string> = {};
		for (const key of Object.keys(request.headers)) {
			const lower = key.toLowerCase();
			if (lower === "host" || lower === "content-length") continue;
			transformedHeaders[lower] = request.headers[key];
		}

		let contentType: string | undefined;
		if (transformedHeaders["content-type"]) contentType = transformedHeaders["content-type"];

		let transformedBody: string | ArrayBuffer | undefined;
		const rawBody = request.body as unknown;
		if (typeof rawBody === "string" || rawBody instanceof ArrayBuffer || rawBody === undefined) {
			transformedBody = rawBody;
		}

		if (ArrayBuffer.isView(request.body)) {
			transformedBody = request.body.buffer.slice(request.body.byteOffset, request.body.byteOffset + request.body.byteLength);
		}

		const param: RequestUrlParam = {
			body: transformedBody,
			headers: transformedHeaders,
			method,
			url,
			contentType,
		};

		const timeoutFn = requestTimeout as (ms?: number) => Promise<never>;
		const raceOfPromises: Promise<unknown>[] = [
			(async (): Promise<{ response: HttpResponse }> => {
				const rsp = await requestUrl(param);
				const headersLower: Record<string, string> = {};
				for (const key of Object.keys(rsp.headers)) headersLower[key.toLowerCase()] = rsp.headers[key];
				const stream = new ReadableStream<Uint8Array>({
					start(controller) { controller.enqueue(new Uint8Array(rsp.arrayBuffer)); controller.close(); },
				});
				return { response: new HttpResponse({ headers: headersLower, statusCode: rsp.status, body: stream }) };
			})(),
			timeoutFn(this.requestTimeoutInMs),
		];

		if (abortSignal) {
			const abortFn = async (): Promise<never> => {
				await new Promise<void>((resolve) => {
					abortSignal.onabort = () => resolve();
				});
				const err = new Error("Request aborted");
				err.name = "AbortError";
				throw err;
			};
			raceOfPromises.push(abortFn());
		}
		const result = await Promise.race(raceOfPromises);
		return result as { response: HttpResponse };
	}
}

export function createS3Client(settings: R2UploaderSettings): S3Client {
	const apiEndpoint = settings.useCustomEndpoint
		? settings.customEndpoint
		: `https://s3.${settings.region}.amazonaws.com/`;
	return new S3Client({
		region: settings.region,
		credentials: { accessKeyId: settings.accessKey, secretAccessKey: settings.secretKey },
		endpoint: apiEndpoint,
		forcePathStyle: settings.forcePathStyle,
		requestHandler: new ObsHttpHandler({ keepAlive: false }),
	});
}

export async function uploadFile(
	s3: S3Client,
	settings: R2UploaderSettings,
	file: File,
	key: string,
): Promise<string> {
	const buf = await file.arrayBuffer();
	await s3.send(new PutObjectCommand({
		Bucket: settings.bucket,
		Key: key,
		Body: new Uint8Array(buf),
		ContentType: file.type,
	}));
	let urlString = settings.imageUrlPath + key;
	if (settings.queryStringKey && settings.queryStringValue) {
		const urlObject = new URL(urlString);
		urlObject.searchParams.append(settings.queryStringKey, settings.queryStringValue);
		urlString = urlObject.toString();
	}
	return urlString;
}

export function formatTimestamp(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
		`${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function resolveFolder(folder: string, noteBasename: string, now: Date): string {
	return folder
		.replace("${year}", now.getFullYear().toString())
		.replace("${month}", String(now.getMonth() + 1).padStart(2, "0"))
		.replace("${day}", String(now.getDate()).padStart(2, "0"))
		.replace("${basename}", noteBasename.replace(/ /g, "-"));
}

export const wrapFileDependingOnType = (location: string, type: string, localBase: string) => {
	const srcPrefix = localBase ? "file://" + localBase + "/" : "";
	if (type === "image") return `![image](${location})`;
	if (type === "video") return `<video src="${srcPrefix}${location}" controls />`;
	if (type === "audio") return `<audio src="${srcPrefix}${location}" controls />`;
	if (type === "pdf") {
		if (localBase) throw new Error("PDFs cannot be embedded in local mode");
		return `<iframe frameborder=0 border=0 width=100% height=800\n\tsrc="https://docs.google.com/viewer?embedded=true&url=${location}?raw=true">\n\t</iframe>`;
	}
	if (type === "ppt") {
		return `<iframe\n\t    src='https://view.officeapps.live.com/op/embed.aspx?src=${location}'\n\t    width='100%' height='600px' frameborder='0'>\n\t  </iframe>`;
	}
	throw new Error("Unknown file type");
};
