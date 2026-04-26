import { Editor, Notice } from "obsidian";
import { filesize } from "filesize";
import { R2UploaderSettings } from "./settings";
import { compressImage, convertToWebP, applyWatermark } from "./imageProcessor";
import { uploadFile, formatTimestamp, wrapFileDependingOnType, resolveFolder } from "./uploader";
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
		if (isInTable) activeWindow.setTimeout(() => { try { editor.refresh(); } catch { /* ignore */ } }, 100);
	} catch (e) {
		console.error("[R2Uploader] replaceText error:", e);
	}
}

export function detectFileType(file: File, settings: { uploadVideo: boolean; uploadAudio: boolean; uploadPdf: boolean }): string {
	if (file.type.match(/video.*/) && settings.uploadVideo) return "video";
	if (file.type.match(/audio.*/) && settings.uploadAudio) return "audio";
	if (file.type.match(/application\/pdf/) && settings.uploadPdf) return "pdf";
	if (file.type.match(/image.*/)) return "image";
	if (file.type.match(/presentation.*/) || file.type.match(/powerpoint.*/)) return "ppt";
	return "";
}

async function processFile(
	file: File,
	thisType: string,
	settings: R2UploaderSettings,
	readBinary: (path: string) => Promise<ArrayBuffer>,
	log: (...args: unknown[]) => void,
): Promise<File> {
	if (thisType !== "image") return file;

	let processedFile = file;
	if (settings.convertToWebP) {
		try { processedFile = await convertToWebP(processedFile, settings, log); }
		catch (e) { console.warn("[R2Uploader] WebP conversion failed:", e); }
	} else {
		log("pipeline: WebP skipped");
	}

	if (settings.enableImageCompression) {
		processedFile = await compressImage(processedFile, settings, log);
	} else {
		log("pipeline: compression skipped");
	}

	if (settings.watermarkEnabled || settings.watermarkLogoEnabled) {
		try { processedFile = await applyWatermark(processedFile, settings, readBinary, log); }
		catch (e) { console.warn("[R2Uploader] Watermark failed:", e); }
	} else {
		log(`pipeline: watermark skipped (text=${settings.watermarkEnabled}, logo=${settings.watermarkLogoEnabled})`);
	}
	return processedFile;
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
	saveSettings: () => Promise<void>,
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

	const startSeq = settings.uploadSeq;
	settings.uploadSeq += files.length;
	await saveSettings();

	const uploads = files.map(async (file, fileIndex) => {
		const thisType = detectFileType(file, { uploadVideo, uploadAudio, uploadPdf });
		if (!thisType) return;

		try {
			log(`pipeline: start — "${file.name}" (${filesize(file.size)}, type=${thisType})`);
			const processedFile = await processFile(file, thisType, settings, readBinary, log);

			const buf = await processedFile.arrayBuffer();
			const seq = startSeq + fileIndex;
			const seqStr = String(seq).padStart(4, "0");
			const ts = formatTimestamp(new Date());
			const ext = processedFile.name.split(".").pop() ?? "bin";
			const newFileName = `${seqStr}_${ts}.${ext}`;
			log(`pipeline: final — ${newFileName} (${filesize(buf.byteLength)})`);

			const folder = localUpload
				? ((fm.uploadFolder as string | undefined) ?? settings.localUploadFolder)
				: ((fm.uploadFolder as string | undefined) ?? settings.folder);

			const keyFolder = resolveFolder(folder, noteFile.basename, new Date());
			const key = keyFolder ? `${keyFolder}/${newFileName}` : newFileName;
			const uploadableFile = new File([buf], newFileName, { type: processedFile.type });

			let url: string;
			if (!localUpload) {
				url = await uploadFile(s3, settings, uploadableFile, key);
			} else {
				await writeBinary(key, new Uint8Array(buf));
				url = getFilePath ? getFilePath(key) : key;
			}

			log(`pipeline: uploaded → ${url}`);
			return wrapFileDependingOnType(url, thisType, "");
		} catch (error) {
			console.error("[R2Uploader]", error);
			const message = error instanceof Error ? error.message : String(error);
			return `Error uploading file: ${message}`;
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
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error: ${message}`);
	}
}
