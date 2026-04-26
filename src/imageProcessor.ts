import { Notice } from "obsidian";
import { filesize } from "filesize";
import imageCompression from "browser-image-compression";
import { R2UploaderSettings } from "./settings";
import { paintTextWatermark, paintLogoWatermark } from "./watermark";

export async function compressImage(
	file: File,
	settings: R2UploaderSettings,
	log: (...args: unknown[]) => void,
): Promise<File> {
	const originalSize = filesize(file.size);
	log(`compressImage: start — ${file.name} (${originalSize}, type=${file.type})`);
	const compressedFile = await imageCompression(file, {
		useWebWorker: false,
		maxWidthOrHeight: settings.maxImageWidthOrHeight,
		maxSizeMB: settings.maxImageCompressionSize,
		initialQuality: settings.imageCompressionQuality,
	});
	log(`compressImage: done — ${originalSize} → ${filesize(compressedFile.size)}`);
	new Notice(`Image compressed from ${originalSize} to ${filesize(compressedFile.size)}`);
	return compressedFile;
}

async function loadImageAndCreateCanvas(
	file: File,
	log: (...args: unknown[]) => void,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; objectUrl: string; width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);
		img.onload = () => {
			log(`loadImageAndCreateCanvas: ${img.naturalWidth}x${img.naturalHeight}`);
			const canvas = activeDocument.createElement("canvas");
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				URL.revokeObjectURL(objectUrl);
				reject(new Error("Canvas unavailable"));
				return;
			}
			ctx.drawImage(img, 0, 0);
			resolve({ canvas, ctx, objectUrl, width: img.naturalWidth, height: img.naturalHeight });
		};
		img.onerror = (e) => {
			URL.revokeObjectURL(objectUrl);
			log("loadImageAndCreateCanvas onerror", e);
			reject(new Error("Failed to load image"));
		};
		img.src = objectUrl;
	});
}

export async function convertToWebP(
	file: File,
	settings: R2UploaderSettings,
	log: (...args: unknown[]) => void,
): Promise<File> {
	log(`convertToWebP: start — ${file.name} (${filesize(file.size)})`);
	const { canvas, objectUrl } = await loadImageAndCreateCanvas(file, log);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			URL.revokeObjectURL(objectUrl);
			if (!blob) {
				reject(new Error("WebP conversion failed"));
				return;
			}
			const name = file.name.replace(/\.[^.]+$/, ".webp");
			log(`convertToWebP: done — ${name} (${filesize(blob.size)})`);
			resolve(new File([blob], name, { type: "image/webp" }));
		}, "image/webp", settings.webpQuality);
	});
}

export async function applyWatermark(
	file: File,
	settings: R2UploaderSettings,
	readBinary: (path: string) => Promise<ArrayBuffer>,
	log: (...args: unknown[]) => void,
): Promise<File> {
	log(`applyWatermark: start — ${file.name}`);
	const { canvas, ctx, objectUrl, width, height } = await loadImageAndCreateCanvas(file, log);
	URL.revokeObjectURL(objectUrl);

	if (settings.watermarkLogoEnabled && settings.watermarkLogoPath) {
		log(`applyWatermark: logo path="${settings.watermarkLogoPath}"`);
		try {
			const logoData = await readBinary(settings.watermarkLogoPath);
			log(`applyWatermark: logoData ${logoData.byteLength}B`);
			await paintLogoWatermark(ctx, width, height, settings, logoData);
			log(`applyWatermark: logo applied`);
		} catch (e) {
			console.warn("[R2Uploader] Logo watermark failed:", e);
		}
	}

	if (settings.watermarkEnabled && settings.watermarkText) {
		log(`applyWatermark: text "${settings.watermarkText}"`);
		paintTextWatermark(ctx, width, height, settings);
		log(`applyWatermark: text applied`);
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("Canvas export failed"));
				return;
			}
			log(`applyWatermark: done — ${filesize(blob.size)}`);
			resolve(new File([blob], file.name, { type: file.type }));
		}, file.type, settings.webpQuality);
	});
}
