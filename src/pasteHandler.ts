import { Editor, Notice } from "obsidian";
import { filesize } from "filesize";
import { R2UploaderSettings } from "./settings";
import { compressImage, convertToWebP, applyWatermark } from "./imageProcessor";
import { uploadFile, generateFileHash, wrapFileDependingOnType } from "./uploader";
import { S3Client } from "@aws-sdk/client-s3";

export async function replaceText(
	editor: Editor,
	target: string,
	replacement: string,
): Promise<void> {
	const content = editor.getValue();
	const position = content.indexOf(target);
	if (position === -1) return;

	const surroundingBefore = content.substring(Math.max(0, position - 20), position);
	const surroundingAfter = content.substring(position + target.length,
		Math.min(content.length, position + target.length + 20));
	const isInTable = surroundingBefore.includes("|") && surroundingAfter.includes("|");
	const from = editor.offsetToPos(position);
	const to = editor.offsetToPos(position + target.length);

	try {
		editor.transaction({ changes: [{ from, to, text: replacement }] });
		if (isInTable) setTimeout(() => { try { editor.refresh(); } catch (_) { /* ignore */ } }, 100);
	} catch (e) {
		console.error("[R2Uploader] replaceText error:", e);
	}
}

export async function pasteHandler(
	ev: ClipboardEvent | DragEvent | Event | null,
	editor: Editor,
	settings: R2UploaderSettings,
	s3: S3Client,
	readBinary: (path: string) => Promise<ArrayBuffer>,
	writeBinary: (path: string, data: Uint8Array) => Promise<void>,
	getFilePath: ((path: string) => string) | null,
	getActiveFile: () => { name: string; basename: string; path: string } | null,
	getFrontmatter: (file: { name: string; path: string }) => Record<string, unknown> | undefined,
	shouldIgnore: () => boolean,
	log: (...args: unknown[]) => void,
	directFile?: File,
): Promise<void> {
	if (ev?.defaultPrevented) return;

	const noteFile = getActiveFile();
	if (!noteFile?.name) return;

	const fm = getFrontmatter(noteFile) ?? {};
	const localUpload = (fm.localUpload as boolean | undefined) ?? settings.localUpload;
	const uploadVideo = (fm.uploadVideo as boolean | undefined) ?? settings.uploadVideo;
	const uploadAudio = (fm.uploadAudio as boolean | undefined) ?? settings.uploadAudio;
	const uploadPdf = (fm.uploadPdf as boolean | undefined) ?? settings.uploadPdf;

	let files: File[] = [];
	if (directFile) {
		files = [directFile];
	} else if (ev) {
		switch (ev.type) {
			case "paste":
				files = Array.from((ev as ClipboardEvent).clipboardData?.files || []);
				break;
			case "drop":
				if (!settings.uploadOnDrag && !(fm.uploadOnDrag)) return;
				files = Array.from((ev as DragEvent).dataTransfer?.files || []);
				break;
			case "input":
				files = Array.from((ev.target as HTMLInputElement).files || []);
				break;
		}
	}

	if (files.length === 0) return;
	if (shouldIgnore()) return;
	if (ev) ev.preventDefault();
	new Notice("Uploading files...");

	const cursorPos = editor.getCursor();

	const uploads = files.map(async (file) => {
		let thisType = "";
		if (file.type.match(/video.*/) && uploadVideo) thisType = "video";
		else if (file.type.match(/audio.*/) && uploadAudio) thisType = "audio";
		else if (file.type.match(/application\/pdf/) && uploadPdf) thisType = "pdf";
		else if (file.type.match(/image.*/)) thisType = "image";
		else if (file.type.match(/presentation.*/) || file.type.match(/powerpoint.*/)) thisType = "ppt";
		if (!thisType) return;

		try {
			log(`pipeline: start — "${file.name}" (${filesize(file.size)}, type=${thisType})`);

			if (thisType === "image") {
				if (settings.convertToWebP) {
					try { file = await convertToWebP(file, settings, log); }
					catch (e) { console.warn("[R2Uploader] WebP conversion failed:", e); }
				} else {
					log("pipeline: WebP skipped");
				}

				if (settings.enableImageCompression) {
					file = await compressImage(file, settings, log);
				} else {
					log("pipeline: compression skipped");
				}

				if (settings.watermarkEnabled || settings.watermarkLogoEnabled) {
					try { file = await applyWatermark(file, settings, readBinary, log); }
					catch (e) { console.warn("[R2Uploader] Watermark failed:", e); }
				} else {
					log(`pipeline: watermark skipped (text=${settings.watermarkEnabled}, logo=${settings.watermarkLogoEnabled})`);
				}
			}

			const buf = await file.arrayBuffer();
			const digest = await generateFileHash(new Uint8Array(buf));
			const ext = file.name.split(".").pop() ?? "bin";
			const newFileName = `${digest}.${ext}`;
			log(`pipeline: final — ${newFileName} (${filesize(buf.byteLength)})`);

			let folder = localUpload
				? ((fm.uploadFolder as string | undefined) ?? settings.localUploadFolder)
				: ((fm.uploadFolder as string | undefined) ?? settings.folder);

			const now = new Date();
			folder = folder
				.replace("${year}", now.getFullYear().toString())
				.replace("${month}", String(now.getMonth() + 1).padStart(2, "0"))
				.replace("${day}", String(now.getDate()).padStart(2, "0"))
				.replace("${basename}", noteFile.basename.replace(/ /g, "-"));

			const key = folder ? `${folder}/${newFileName}` : newFileName;
			const renamedFile = new File([buf], newFileName, { type: file.type });

			let url: string;
			if (!localUpload) {
				url = await uploadFile(s3, settings, renamedFile, key);
			} else {
				await writeBinary(key, new Uint8Array(buf));
				url = getFilePath ? getFilePath(key) : key;
			}

			log(`pipeline: uploaded → ${url}`);
			return wrapFileDependingOnType(url, thisType, "");
		} catch (error) {
			console.error("[R2Uploader]", error);
			return `Error uploading file: ${error.message}`;
		}
	});

	try {
		const results = await Promise.all(uploads);
		const validResults = results.filter((r) => r !== undefined);
		if (validResults.length > 0) {
			editor.transaction({ changes: [{ from: cursorPos, text: validResults.join("\n") }] });
			new Notice("All files uploaded successfully");
		}
	} catch (error) {
		console.error("[R2Uploader] upload error:", error);
		new Notice(`Error: ${error.message}`);
	}
}
