import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TextComponent,
	setIcon,
	RequestUrlParam,
	requestUrl,
	TFile,
	MarkdownView,
} from "obsidian";
import { HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { HttpHandlerOptions } from "@aws-sdk/types";
import { buildQueryString } from "@aws-sdk/querystring-builder";
import { requestTimeout } from "@smithy/fetch-http-handler/dist-es/request-timeout";

import {
	FetchHttpHandler,
	FetchHttpHandlerOptions,
} from "@smithy/fetch-http-handler";

import { filesize } from "filesize";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import imageCompression from "browser-image-compression";
import { minimatch } from "minimatch";

// Based on jvsteiner/s3-image-uploader (MIT License)
// Extended with WebP conversion, watermark with live preview, and collapsible settings UI.

interface pasteFunction {
	(
		this: HTMLElement,
		event: ClipboardEvent | DragEvent,
		editor: Editor,
	): void;
}

type WatermarkPosition =
	| "bottom-right"
	| "bottom-left"
	| "bottom-center"
	| "center";

interface R2UploaderSettings {
	accessKey: string;
	secretKey: string;
	region: string;
	bucket: string;
	folder: string;
	imageUrlPath: string;
	uploadOnDrag: boolean;
	localUpload: boolean;
	localUploadFolder: string;
	useCustomEndpoint: boolean;
	customEndpoint: string;
	forcePathStyle: boolean;
	useCustomImageUrl: boolean;
	customImageUrl: string;
	uploadVideo: boolean;
	uploadAudio: boolean;
	uploadPdf: boolean;
	bypassCors: boolean;
	queryStringValue: string;
	queryStringKey: string;
	enableImageCompression: boolean;
	maxImageCompressionSize: number;
	imageCompressionQuality: number;
	maxImageWidthOrHeight: number;
	ignorePattern: string;
	disableAutoUploadOnCreate: boolean;
	// WebP conversion
	convertToWebP: boolean;
	webpQuality: number;
	// Watermark — text
	watermarkEnabled: boolean;
	watermarkText: string;
	watermarkFont: string; // kept for backward compat; UI uses decomposed fields below
	watermarkFontFamily: string;
	watermarkFontSize: number;   // 0 = auto (2% of image width)
	watermarkBold: boolean;
	watermarkItalic: boolean;
	watermarkColor: string;
	watermarkPosition: WatermarkPosition;
	watermarkOffsetX: number;    // -30 ~ 30, % of image width
	watermarkOffsetY: number;    // -30 ~ 30, % of image height
	// Watermark — logo image
	watermarkLogoEnabled: boolean;
	watermarkLogoPath: string;
	watermarkLogoSize: number;
	watermarkLogoOpacity: number;
	watermarkLogoPosition: WatermarkPosition;
	watermarkLogoOffsetX: number;
	watermarkLogoOffsetY: number;
	// Preview background
	previewBackground: "checker" | "white" | "black" | "custom";
	previewBackgroundColor: string;
	// Debug
	debugMode: boolean;
}

const DEFAULT_SETTINGS: R2UploaderSettings = {
	accessKey: "",
	secretKey: "",
	region: "",
	bucket: "",
	folder: "",
	imageUrlPath: "",
	uploadOnDrag: true,
	localUpload: false,
	localUploadFolder: "",
	useCustomEndpoint: false,
	customEndpoint: "",
	forcePathStyle: false,
	useCustomImageUrl: false,
	customImageUrl: "",
	uploadVideo: false,
	uploadAudio: false,
	uploadPdf: false,
	bypassCors: false,
	queryStringValue: "",
	queryStringKey: "",
	enableImageCompression: false,
	maxImageCompressionSize: 1,
	imageCompressionQuality: 0.7,
	maxImageWidthOrHeight: 4096,
	ignorePattern: "",
	disableAutoUploadOnCreate: false,
	convertToWebP: true,
	webpQuality: 0.85,
	watermarkEnabled: false,
	watermarkText: "© firstsun.org",
	watermarkFont: "16px Arial",
	watermarkFontFamily: "Arial",
	watermarkFontSize: 0,
	watermarkBold: false,
	watermarkItalic: false,
	watermarkColor: "rgba(255, 255, 255, 0.85)",
	watermarkPosition: "bottom-right",
	watermarkOffsetX: 0,
	watermarkOffsetY: 0,
	watermarkLogoEnabled: false,
	watermarkLogoPath: "",
	watermarkLogoSize: 15,
	watermarkLogoOpacity: 0.5,
	watermarkLogoPosition: "bottom-right",
	watermarkLogoOffsetX: 0,
	watermarkLogoOffsetY: 0,
	previewBackground: "checker",
	previewBackgroundColor: "#888888",
	debugMode: false,
};

// ── Shared drawing helpers (used by plugin + preview canvas) ──────────────────

function buildFont(s: R2UploaderSettings, imageWidth: number): string {
	const autoSize = Math.min(120, Math.max(14, Math.round(imageWidth * 0.02)));
	const size = s.watermarkFontSize > 0 ? s.watermarkFontSize : autoSize;
	const parts: string[] = [];
	if (s.watermarkBold) parts.push("bold");
	if (s.watermarkItalic) parts.push("italic");
	parts.push(`${size}px`);
	parts.push(s.watermarkFontFamily || "Arial");
	return parts.join(" ");
}

function resolvePosition(
	position: WatermarkPosition,
	imgW: number,
	imgH: number,
	elemW: number,
	elemH: number,
	padding: number,
	offsetXPct = 0,
	offsetYPct = 0,
): { x: number; y: number } {
	const ox = Math.round((imgW * offsetXPct) / 100);
	const oy = Math.round((imgH * offsetYPct) / 100);
	switch (position) {
		case "bottom-right":
			return { x: Math.round(imgW - elemW - padding + ox), y: Math.round(imgH - padding + oy) };
		case "bottom-left":
			return { x: Math.round(padding + ox), y: Math.round(imgH - padding + oy) };
		case "bottom-center":
			return { x: Math.round((imgW - elemW) / 2 + ox), y: Math.round(imgH - padding + oy) };
		case "center":
			return { x: Math.round((imgW - elemW) / 2 + ox), y: Math.round((imgH + elemH) / 2 + oy) };
	}
}

function paintTextWatermark(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	s: R2UploaderSettings,
): void {
	if (!s.watermarkEnabled || !s.watermarkText) return;
	const font = buildFont(s, w);
	ctx.save();
	ctx.font = font;
	const metrics = ctx.measureText(s.watermarkText);
	const textW = metrics.width;
	const textH = parseInt(font, 10) || 14;
	const padding = Math.round(w * 0.015);
	const { x, y } = resolvePosition(
		s.watermarkPosition, w, h, textW, textH, padding,
		s.watermarkOffsetX, s.watermarkOffsetY,
	);
	// Stroke outline for visibility on any background
	ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
	ctx.lineWidth = textH * 0.12;
	ctx.lineJoin = "round";
	ctx.strokeText(s.watermarkText, x, y);
	ctx.fillStyle = s.watermarkColor;
	ctx.fillText(s.watermarkText, x, y);
	ctx.restore();
}

async function paintLogoWatermark(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	s: R2UploaderSettings,
	logoData: ArrayBuffer,
): Promise<void> {
	const ext = s.watermarkLogoPath.split(".").pop()?.toLowerCase() ?? "";
	const mimeType =
		ext === "png" ? "image/png" :
		ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
		ext === "webp" ? "image/webp" :
		ext === "svg" ? "image/svg+xml" :
		"image/png";

	await new Promise<void>((resolve, reject) => {
		const blob = new Blob([logoData], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			const logoW = Math.round((w * s.watermarkLogoSize) / 100);
			const logoH = Math.round((img.naturalHeight / img.naturalWidth) * logoW);
			const padding = Math.round(w * 0.015);
			const { x, y } = resolvePosition(
				s.watermarkLogoPosition, w, h, logoW, logoH, padding,
				s.watermarkLogoOffsetX, s.watermarkLogoOffsetY,
			);
			ctx.save();
			ctx.globalAlpha = s.watermarkLogoOpacity;
			ctx.drawImage(img, x, y - logoH, logoW, logoH);
			ctx.restore();
			URL.revokeObjectURL(url);
			resolve();
		};
		img.onerror = (e) => {
			URL.revokeObjectURL(url);
			reject(new Error(`Logo image load failed: ${e}`));
		};
		img.src = url;
	});
}

function paintCheckerboard(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
): void {
	const size = 12;
	for (let row = 0; row * size < h; row++) {
		for (let col = 0; col * size < w; col++) {
			ctx.fillStyle = (row + col) % 2 === 0 ? "#cccccc" : "#ffffff";
			ctx.fillRect(col * size, row * size, size, size);
		}
	}
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class R2UploaderPlugin extends Plugin {
	settings: R2UploaderSettings;
	s3: S3Client;
	pasteFunction: pasteFunction;

	private log(...args: unknown[]): void {
		if (this.settings.debugMode) {
			console.log("[R2Uploader]", ...args);
		}
	}

	private async replaceText(
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

	private shouldIgnoreCurrentFile(): boolean {
		const noteFile = this.app.workspace.getActiveFile();
		if (!noteFile || !this.settings.ignorePattern) return false;
		return matchesGlobPattern(noteFile.path, this.settings.ignorePattern);
	}

	async uploadFile(file: File, key: string): Promise<string> {
		if (!this.s3) throw new Error("S3 client not configured. Please configure plugin settings.");
		const buf = await file.arrayBuffer();
		await this.s3.send(new PutObjectCommand({
			Bucket: this.settings.bucket,
			Key: key,
			Body: new Uint8Array(buf),
			ContentType: file.type,
		}));
		let urlString = this.settings.imageUrlPath + key;
		if (this.settings.queryStringKey && this.settings.queryStringValue) {
			const urlObject = new URL(urlString);
			urlObject.searchParams.append(this.settings.queryStringKey, this.settings.queryStringValue);
			urlString = urlObject.toString();
		}
		return urlString;
	}

	async compressImage(file: File): Promise<File> {
		const originalSize = filesize(file.size);
		this.log(`compressImage: start — ${file.name} (${originalSize}, type=${file.type})`);
		const compressedFile = await imageCompression(file, {
			useWebWorker: false,
			maxWidthOrHeight: this.settings.maxImageWidthOrHeight,
			maxSizeMB: this.settings.maxImageCompressionSize,
			initialQuality: this.settings.imageCompressionQuality,
		});
		this.log(`compressImage: done — ${originalSize} → ${filesize(compressedFile.size)}`);
		new Notice(`Image compressed from ${originalSize} to ${filesize(compressedFile.size)}`);
		return compressedFile;
	}

	async convertToWebP(file: File): Promise<File> {
		this.log(`convertToWebP: start — ${file.name} (${filesize(file.size)})`);
		return new Promise((resolve, reject) => {
			const img = new Image();
			const objectUrl = URL.createObjectURL(file);
			img.onload = () => {
				this.log(`convertToWebP: ${img.naturalWidth}x${img.naturalHeight}`);
				const canvas = document.createElement("canvas");
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext("2d");
				if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error("Canvas unavailable")); return; }
				ctx.drawImage(img, 0, 0);
				canvas.toBlob((blob) => {
					URL.revokeObjectURL(objectUrl);
					if (!blob) { reject(new Error("WebP conversion failed")); return; }
					const name = file.name.replace(/\.[^.]+$/, ".webp");
					this.log(`convertToWebP: done — ${name} (${filesize(blob.size)})`);
					resolve(new File([blob], name, { type: "image/webp" }));
				}, "image/webp", this.settings.webpQuality);
			};
			img.onerror = (e) => { URL.revokeObjectURL(objectUrl); this.log("convertToWebP onerror", e); reject(new Error("Failed to load image")); };
			img.src = objectUrl;
		});
	}

	async applyWatermark(file: File): Promise<File> {
		this.log(`applyWatermark: start — ${file.name}`);
		return new Promise((resolve, reject) => {
			const img = new Image();
			const objectUrl = URL.createObjectURL(file);
			img.onload = async () => {
				this.log(`applyWatermark: ${img.naturalWidth}x${img.naturalHeight}`);
				const canvas = document.createElement("canvas");
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext("2d");
				if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error("Canvas unavailable")); return; }
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(objectUrl);

				if (this.settings.watermarkLogoEnabled && this.settings.watermarkLogoPath) {
					this.log(`applyWatermark: logo path="${this.settings.watermarkLogoPath}"`);
					try {
						const logoData = await this.app.vault.adapter.readBinary(this.settings.watermarkLogoPath);
						this.log(`applyWatermark: logoData ${logoData.byteLength}B`);
						await paintLogoWatermark(ctx, canvas.width, canvas.height, this.settings, logoData);
						this.log(`applyWatermark: logo applied`);
					} catch (e) {
						console.warn("[R2Uploader] Logo watermark failed:", e);
					}
				}

				if (this.settings.watermarkEnabled && this.settings.watermarkText) {
					this.log(`applyWatermark: text "${this.settings.watermarkText}"`);
					paintTextWatermark(ctx, canvas.width, canvas.height, this.settings);
					this.log(`applyWatermark: text applied`);
				}

				canvas.toBlob((blob) => {
					if (!blob) { reject(new Error("Canvas export failed")); return; }
					this.log(`applyWatermark: done — ${filesize(blob.size)}`);
					resolve(new File([blob], file.name, { type: file.type }));
				}, file.type, this.settings.webpQuality);
			};
			img.onerror = (e) => { URL.revokeObjectURL(objectUrl); this.log("applyWatermark onerror", e); reject(new Error("Failed to load image")); };
			img.src = objectUrl;
		});
	}

	async pasteHandler(
		ev: ClipboardEvent | DragEvent | Event | null,
		editor: Editor,
		directFile?: File,
	): Promise<void> {
		if (ev?.defaultPrevented) return;

		const noteFile = this.app.workspace.getActiveFile();
		if (!noteFile?.name) return;

		const fm = this.app.metadataCache.getFileCache(noteFile)?.frontmatter;
		const localUpload = fm?.localUpload ?? this.settings.localUpload;
		const uploadVideo = fm?.uploadVideo ?? this.settings.uploadVideo;
		const uploadAudio = fm?.uploadAudio ?? this.settings.uploadAudio;
		const uploadPdf = fm?.uploadPdf ?? this.settings.uploadPdf;

		let files: File[] = [];
		if (directFile) {
			files = [directFile];
		} else if (ev) {
			switch (ev.type) {
				case "paste":
					files = Array.from((ev as ClipboardEvent).clipboardData?.files || []);
					break;
				case "drop":
					if (!this.settings.uploadOnDrag && !(fm?.uploadOnDrag)) return;
					files = Array.from((ev as DragEvent).dataTransfer?.files || []);
					break;
				case "input":
					files = Array.from((ev.target as HTMLInputElement).files || []);
					break;
			}
		}

		if (files.length === 0) return;
		if (this.shouldIgnoreCurrentFile()) return;
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
				this.log(`pipeline: start — "${file.name}" (${filesize(file.size)}, type=${thisType})`);

				if (thisType === "image") {
					if (this.settings.convertToWebP) {
						try { file = await this.convertToWebP(file); }
						catch (e) { console.warn("[R2Uploader] WebP conversion failed:", e); }
					} else {
						this.log("pipeline: WebP skipped");
					}

					if (this.settings.enableImageCompression) {
						file = await this.compressImage(file);
					} else {
						this.log("pipeline: compression skipped");
					}

					if (this.settings.watermarkEnabled || this.settings.watermarkLogoEnabled) {
						try { file = await this.applyWatermark(file); }
						catch (e) { console.warn("[R2Uploader] Watermark failed:", e); }
					} else {
						this.log(`pipeline: watermark skipped (text=${this.settings.watermarkEnabled}, logo=${this.settings.watermarkLogoEnabled})`);
					}
				}

				const buf = await file.arrayBuffer();
				const digest = await generateFileHash(new Uint8Array(buf));
				const ext = file.name.split(".").pop() ?? "bin";
				const newFileName = `${digest}.${ext}`;
				this.log(`pipeline: final — ${newFileName} (${filesize(buf.byteLength)})`);

				let folder = localUpload
					? (fm?.uploadFolder ?? this.settings.localUploadFolder)
					: (fm?.uploadFolder ?? this.settings.folder);

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
					url = await this.uploadFile(renamedFile, key);
				} else {
					await this.app.vault.adapter.writeBinary(key, new Uint8Array(buf));
					url = "getFilePath" in this.app.vault.adapter
						? (this.app.vault.adapter as any).getFilePath(key)
						: key;
				}

				this.log(`pipeline: uploaded → ${url}`);
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

	createS3Client(): void {
		if (!this.settings.region) return;
		const apiEndpoint = this.settings.useCustomEndpoint
			? this.settings.customEndpoint
			: `https://s3.${this.settings.region}.amazonaws.com/`;
		this.settings.imageUrlPath = this.settings.useCustomImageUrl
			? this.settings.customImageUrl
			: this.settings.forcePathStyle
				? apiEndpoint + this.settings.bucket + "/"
				: apiEndpoint.replace("://", `://${this.settings.bucket}.`);

		this.s3 = new S3Client({
			region: this.settings.region,
			credentials: { accessKeyId: this.settings.accessKey, secretAccessKey: this.settings.secretKey },
			endpoint: apiEndpoint,
			forcePathStyle: this.settings.forcePathStyle,
			requestHandler: new ObsHttpHandler({ keepAlive: false }),
		});
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new R2UploaderSettingTab(this.app, this));
		this.createS3Client();

		this.addCommand({
			id: "upload-image",
			name: "Upload image",
			icon: "image-plus",
			mobileOnly: false,
			editorCallback: (editor) => {
				const input = document.createElement("input");
				input.type = "file";
				input.oninput = (event) => { if (event.target) this.pasteHandler(event, editor); };
				input.click();
				input.remove();
			},
		});

		this.pasteFunction = (event, editor) => this.pasteHandler(event, editor);
		this.registerEvent(this.app.workspace.on("editor-paste", this.pasteFunction));
		this.registerEvent(this.app.workspace.on("editor-drop", this.pasteFunction));

		this.registerEvent(this.app.vault.on("create", async (file) => {
			if (this.settings.disableAutoUploadOnCreate) return;
			if (!(file instanceof TFile)) return;
			if (!file.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;
			if (this.shouldIgnoreCurrentFile()) return;
			try {
				const fileContent = await this.app.vault.readBinary(file);
				const newFile = new File([fileContent], file.name, { type: `image/${file.extension}` });
				await this.pasteHandler(null, activeView.editor, newFile);
				await new Promise((resolve) => setTimeout(resolve, 50));
				const content = activeView.editor.getValue();
				const obsidianLink = (this.app.vault as any).getConfig("useMarkdownLinks")
					? `![](${file.name.split(" ").join("%20")})`
					: `![[${file.name}]]`;
				const position = content.indexOf(obsidianLink);
				if (position !== -1) {
					const from = activeView.editor.offsetToPos(position);
					const to = activeView.editor.offsetToPos(position + obsidianLink.length);
					activeView.editor.replaceRange("", from, to);
				} else {
					new Notice(`Failed to find: ${obsidianLink}`);
				}
				await this.app.vault.delete(file);
			} catch (error) {
				new Notice(`Error processing file: ${error.message}`);
			}
		}));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

class R2UploaderSettingTab extends PluginSettingTab {
	plugin: R2UploaderPlugin;
	private previewCanvas: HTMLCanvasElement | null = null;
	private compressionSettings: Setting[] = [];
	private watermarkTextSettings: Setting[] = [];
	private watermarkLogoSettings: Setting[] = [];

	constructor(app: App, plugin: R2UploaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// ── preview ───────────────────────────────────────────────────────────────

	private async renderPreview(): Promise<void> {
		const canvas = this.previewCanvas;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		// Scale to device pixel ratio so canvas is crisp on HiDPI/Retina displays
		const dpr = window.devicePixelRatio || 1;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		// Use logical dimensions (CSS pixels) for all drawing
		const W = 400;
		const H = 225;
		const s = this.plugin.settings;

		// Background
		const bg = s.previewBackground;
		if (bg === "checker") {
			paintCheckerboard(ctx, W, H);
		} else if (bg === "white") {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, W, H);
		} else if (bg === "black") {
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, W, H);
		} else {
			ctx.fillStyle = s.previewBackgroundColor || "#888888";
			ctx.fillRect(0, 0, W, H);
		}

		// Logo (async)
		if (s.watermarkLogoEnabled && s.watermarkLogoPath) {
			try {
				const logoData = await this.plugin.app.vault.adapter.readBinary(s.watermarkLogoPath);
				await paintLogoWatermark(ctx, W, H, s, logoData);
			} catch (_) {
				// Show placeholder rect
				const logoW = Math.round((W * s.watermarkLogoSize) / 100);
				const logoH = Math.round(logoW * 0.4);
				const padding = Math.round(W * 0.015);
				const { x, y } = resolvePosition(s.watermarkLogoPosition, W, H, logoW, logoH, padding, s.watermarkLogoOffsetX, s.watermarkLogoOffsetY);
				ctx.save();
				ctx.globalAlpha = s.watermarkLogoOpacity * 0.4;
				ctx.fillStyle = "#888";
				ctx.fillRect(x, y - logoH, logoW, logoH);
				ctx.fillStyle = "#fff";
				ctx.font = `${Math.round(logoH * 0.4)}px Arial`;
				ctx.textAlign = "center";
				ctx.fillText("LOGO", x + logoW / 2, y - logoH / 2 + Math.round(logoH * 0.15));
				ctx.restore();
			}
		}

		// Text
		paintTextWatermark(ctx, W, H, s);
	}

	private refreshPreview(): void {
		this.renderPreview().catch(() => {/* ignore */});
	}

	// ── helpers ───────────────────────────────────────────────────────────────

	private save = async (): Promise<void> => {
		await this.plugin.saveSettings();
		this.refreshPreview();
	};

	private toggle(settings: Setting[], show: boolean): void {
		settings.forEach((s) => (s.settingEl.style.display = show ? "" : "none"));
	}

	private makeSection(
		parent: HTMLElement,
		label: string,
		open = false,
		icon?: string,
	): HTMLElement {
		const details = parent.createEl("details", { cls: "r2-section" });
		if (open) details.setAttribute("open", "");
		const summary = details.createEl("summary", { cls: "r2-section-summary" });
		if (icon) {
			const iconEl = summary.createSpan({ cls: "r2-section-icon" });
			setIcon(iconEl, icon);
		}
		summary.createSpan({ text: label });
		return details;
	}

	// ── display ───────────────────────────────────────────────────────────────

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("r2-settings");

		containerEl.createEl("h2", { text: "Watermark S3 Uploader" });

		// ── Connection (collapsed) ────────────────────────────────────────────
		const connEl = this.makeSection(containerEl, "Connection Settings", false, "key");

		new Setting(connEl)
			.setName("Access Key ID")
			.addText((text) => {
				wrapTextWithPasswordHide(text);
				text.setPlaceholder("access key")
					.setValue(this.plugin.settings.accessKey)
					.onChange(async (v) => { this.plugin.settings.accessKey = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); });
			});

		new Setting(connEl)
			.setName("Secret Key")
			.addText((text) => {
				wrapTextWithPasswordHide(text);
				text.setPlaceholder("secret key")
					.setValue(this.plugin.settings.secretKey)
					.onChange(async (v) => { this.plugin.settings.secretKey = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); });
			});

		new Setting(connEl)
			.setName("Region")
			.setDesc('"auto" for Cloudflare R2')
			.addText((text) =>
				text.setPlaceholder("auto")
					.setValue(this.plugin.settings.region)
					.onChange(async (v) => { this.plugin.settings.region = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(connEl)
			.setName("S3 Bucket")
			.addText((text) =>
				text.setPlaceholder("bucket name")
					.setValue(this.plugin.settings.bucket)
					.onChange(async (v) => { this.plugin.settings.bucket = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(connEl)
			.setName("Bucket Folder")
			.setDesc("Supports ${year}, ${month}, ${day}, ${basename}")
			.addText((text) =>
				text.setPlaceholder("blog/${basename}")
					.setValue(this.plugin.settings.folder)
					.onChange(async (v) => { this.plugin.settings.folder = v.trim(); await this.plugin.saveSettings(); }));

		// Advanced connection
		const advConn = this.makeSection(connEl, "Advanced", false, "settings-2");

		new Setting(advConn)
			.setName("Use Custom Endpoint")
			.setDesc("Enable for Cloudflare R2 or other S3-compatible providers.")
			.addToggle((t) => t.setValue(this.plugin.settings.useCustomEndpoint)
				.onChange(async (v) => { this.plugin.settings.useCustomEndpoint = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Custom Endpoint URL")
			.addText((text) =>
				text.setPlaceholder("https://xxxx.r2.cloudflarestorage.com/")
					.setValue(this.plugin.settings.customEndpoint)
					.onChange(async (v) => {
						v = v.match(/^https?:\/\//) ? v : "https://" + v;
						v = v.replace(/([^/])$/, "$1/");
						this.plugin.settings.customEndpoint = v.trim();
						this.plugin.createS3Client(); await this.plugin.saveSettings();
					}));

		new Setting(advConn)
			.setName("Force Path-Style URLs")
			.addToggle((t) => t.setValue(this.plugin.settings.forcePathStyle)
				.onChange(async (v) => { this.plugin.settings.forcePathStyle = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Use Custom Image URL")
			.setDesc("Override public URL base (CDN / custom domain).")
			.addToggle((t) => t.setValue(this.plugin.settings.useCustomImageUrl)
				.onChange(async (v) => { this.plugin.settings.useCustomImageUrl = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Custom Image URL")
			.addText((text) =>
				text.setValue(this.plugin.settings.customImageUrl)
					.onChange(async (v) => {
						v = v.match(/^https?:\/\//) ? v : "https://" + v;
						v = v.replace(/([^/])$/, "$1/");
						this.plugin.settings.customImageUrl = v.trim();
						this.plugin.createS3Client(); await this.plugin.saveSettings();
					}));

		new Setting(advConn)
			.setName("Bypass Local CORS Check")
			.addToggle((t) => t.setValue(this.plugin.settings.bypassCors)
				.onChange(async (v) => { this.plugin.settings.bypassCors = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Query String Key")
			.addText((text) =>
				text.setPlaceholder("e.g. v")
					.setValue(this.plugin.settings.queryStringKey)
					.onChange(async (v) => { this.plugin.settings.queryStringKey = v; await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Query String Value")
			.addText((text) =>
				text.setPlaceholder("e.g. 1")
					.setValue(this.plugin.settings.queryStringValue)
					.onChange(async (v) => { this.plugin.settings.queryStringValue = v; await this.plugin.saveSettings(); }));

		// ── Upload Behavior (collapsed) ───────────────────────────────────────
		const uploadEl = this.makeSection(containerEl, "Upload Behavior", false, "upload-cloud");

		new Setting(uploadEl)
			.setName("Upload on Drag")
			.setDesc("Also upload images dropped into the editor.")
			.addToggle((t) => t.setValue(this.plugin.settings.uploadOnDrag)
				.onChange(async (v) => { this.plugin.settings.uploadOnDrag = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl).setName("Upload Video Files").addToggle((t) =>
			t.setValue(this.plugin.settings.uploadVideo).onChange(async (v) => { this.plugin.settings.uploadVideo = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl).setName("Upload Audio Files").addToggle((t) =>
			t.setValue(this.plugin.settings.uploadAudio).onChange(async (v) => { this.plugin.settings.uploadAudio = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl).setName("Upload PDF Files").addToggle((t) =>
			t.setValue(this.plugin.settings.uploadPdf).onChange(async (v) => { this.plugin.settings.uploadPdf = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Copy to Local Folder Instead")
			.addToggle((t) => t.setValue(this.plugin.settings.localUpload)
				.onChange(async (v) => { this.plugin.settings.localUpload = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Local Folder Path")
			.addText((text) =>
				text.setPlaceholder("folder").setValue(this.plugin.settings.localUploadFolder)
					.onChange(async (v) => { this.plugin.settings.localUploadFolder = v.trim(); await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Disable Auto-Upload on File Create")
			.setDesc("Prevent uploads when files are created by sync tools.")
			.addToggle((t) => t.setValue(this.plugin.settings.disableAutoUploadOnCreate)
				.onChange(async (v) => { this.plugin.settings.disableAutoUploadOnCreate = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Ignore Pattern")
			.setDesc("Glob patterns to skip, comma-separated. E.g. private/*, **/drafts/**")
			.addText((text) =>
				text.setPlaceholder("private/*, **/drafts/**")
					.setValue(this.plugin.settings.ignorePattern)
					.onChange(async (v) => { this.plugin.settings.ignorePattern = v.trim(); await this.plugin.saveSettings(); }));

		// ── Image Processing (open) ───────────────────────────────────────────
		const imgEl = this.makeSection(containerEl, "Image Processing", true, "image");

		new Setting(imgEl)
			.setName("Convert to WebP")
			.setDesc("Convert images to WebP before uploading. Filename becomes .webp.")
			.addToggle((t) => t.setValue(this.plugin.settings.convertToWebP)
				.onChange(async (v) => { this.plugin.settings.convertToWebP = v; await this.plugin.saveSettings(); }));

		new Setting(imgEl)
			.setName("WebP Quality")
			.setDesc("0.1 (small file) — 1.0 (best quality). Default: 0.85")
			.addSlider((s) => s.setDynamicTooltip().setLimits(0.1, 1.0, 0.05)
				.setValue(this.plugin.settings.webpQuality)
				.onChange(async (v) => { this.plugin.settings.webpQuality = v; await this.plugin.saveSettings(); }));

		new Setting(imgEl)
			.setName("Enable Compression")
			.addToggle((t) => t.setValue(this.plugin.settings.enableImageCompression)
				.onChange(async (v) => {
					this.plugin.settings.enableImageCompression = v;
					await this.plugin.saveSettings();
					this.toggle(this.compressionSettings, v);
				}));

		this.compressionSettings = [
			new Setting(imgEl)
				.setName("Max Size (MB)")
				.addText((text) =>
					text.setPlaceholder("1").setValue(this.plugin.settings.maxImageCompressionSize.toString())
						.onChange(async (v) => {
							const n = parseFloat(v);
							if (!isNaN(n) && n > 0) { this.plugin.settings.maxImageCompressionSize = n; await this.plugin.saveSettings(); }
						})),

			new Setting(imgEl)
				.setName("Compression Quality")
				.addSlider((s) => s.setDynamicTooltip().setLimits(0.0, 1.0, 0.05)
					.setValue(this.plugin.settings.imageCompressionQuality)
					.onChange(async (v) => { this.plugin.settings.imageCompressionQuality = v; await this.plugin.saveSettings(); })),

			new Setting(imgEl)
				.setName("Max Width / Height (px)")
				.addText((text) =>
					text.setPlaceholder("4096").setValue(this.plugin.settings.maxImageWidthOrHeight.toString())
						.onChange(async (v) => {
							const n = parseInt(v);
							if (!isNaN(n) && n > 0) { this.plugin.settings.maxImageWidthOrHeight = n; await this.plugin.saveSettings(); }
						})),
		];
		this.toggle(this.compressionSettings, this.plugin.settings.enableImageCompression);

		// ── Watermark (open) ──────────────────────────────────────────────────
		const wmEl = this.makeSection(containerEl, "Watermark", true, "stamp");

		// Preview canvas
		const previewWrap = wmEl.createDiv({ cls: "r2-preview-wrap" });
		this.previewCanvas = previewWrap.createEl("canvas", { cls: "r2-preview-canvas" });
		const dpr = window.devicePixelRatio || 1;
		this.previewCanvas.width = 400 * dpr;
		this.previewCanvas.height = 225 * dpr;
		this.previewCanvas.style.width = "400px";
		this.previewCanvas.style.height = "225px";

		// Preview background control
		let customColorSetting: Setting;
		const bgSetting = new Setting(previewWrap)
			.setName("Preview background")
			.setClass("r2-preview-bg-setting")
			.addDropdown((d) =>
				d.addOptions({ checker: "Checkered", white: "White", black: "Black", custom: "Custom color" })
					.setValue(this.plugin.settings.previewBackground)
					.onChange(async (v: string) => {
						this.plugin.settings.previewBackground = v as R2UploaderSettings["previewBackground"];
						await this.plugin.saveSettings();
						customColorSetting.settingEl.style.display = v === "custom" ? "" : "none";
						this.refreshPreview();
					}));
		// suppress unused warning
		void bgSetting;
		customColorSetting = new Setting(previewWrap)
			.setName("Background color")
			.addColorPicker((cp) =>
				cp.setValue(this.plugin.settings.previewBackgroundColor)
					.onChange(async (v) => {
						this.plugin.settings.previewBackgroundColor = v;
						await this.plugin.saveSettings();
						this.refreshPreview();
					}));
		customColorSetting.settingEl.style.display =
			this.plugin.settings.previewBackground === "custom" ? "" : "none";

		previewWrap.createEl("p", { text: "Preview (400×225 px)", cls: "r2-preview-label" });
		this.refreshPreview();

		// ── Text watermark ────────────────────────────────────────────────────
		wmEl.createEl("h4", { text: "Text Watermark" });

		new Setting(wmEl)
			.setName("Enable Text Watermark")
			.addToggle((t) => t.setValue(this.plugin.settings.watermarkEnabled)
				.onChange(async (v) => {
					this.plugin.settings.watermarkEnabled = v;
					await this.save();
					this.toggle(this.watermarkTextSettings, v);
				}));

		this.watermarkTextSettings = [
			new Setting(wmEl)
				.setName("Text")
				.addText((text) =>
					text.setPlaceholder("© firstsun.org")
						.setValue(this.plugin.settings.watermarkText)
						.onChange(async (v) => { this.plugin.settings.watermarkText = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Font Family")
				.setDesc('e.g. "Arial", "Georgia", "monospace"')
				.addText((text) =>
					text.setPlaceholder("Arial")
						.setValue(this.plugin.settings.watermarkFontFamily)
						.onChange(async (v) => { this.plugin.settings.watermarkFontFamily = v || "Arial"; await this.save(); })),

			new Setting(wmEl)
				.setName("Font Size (px)")
				.setDesc("0 = auto (2% of image width)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(0, 120, 2)
					.setValue(this.plugin.settings.watermarkFontSize)
					.onChange(async (v) => { this.plugin.settings.watermarkFontSize = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Style")
				.addToggle((t) => t.setValue(this.plugin.settings.watermarkBold)
					.onChange(async (v) => { this.plugin.settings.watermarkBold = v; await this.save(); }))
				.addExtraButton((b) => b.setTooltip("Bold").setIcon("bold"))
				.addToggle((t) => t.setValue(this.plugin.settings.watermarkItalic)
					.onChange(async (v) => { this.plugin.settings.watermarkItalic = v; await this.save(); }))
				.addExtraButton((b) => b.setTooltip("Italic").setIcon("italic")),

			new Setting(wmEl)
				.setName("Color")
				.setDesc('CSS color, e.g. "rgba(255,255,255,0.85)" or "#ffffff"')
				.addText((text) =>
					text.setPlaceholder("rgba(255,255,255,0.85)")
						.setValue(this.plugin.settings.watermarkColor)
						.onChange(async (v) => { this.plugin.settings.watermarkColor = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Position")
				.addDropdown((d) =>
					d.addOption("bottom-right", "Bottom Right")
						.addOption("bottom-left", "Bottom Left")
						.addOption("bottom-center", "Bottom Center")
						.addOption("center", "Center")
						.setValue(this.plugin.settings.watermarkPosition)
						.onChange(async (v) => { this.plugin.settings.watermarkPosition = v as WatermarkPosition; await this.save(); })),

			new Setting(wmEl)
				.setName("Offset X")
				.setDesc("Horizontal nudge (% of image width, negative = left)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(-30, 30, 1)
					.setValue(this.plugin.settings.watermarkOffsetX)
					.onChange(async (v) => { this.plugin.settings.watermarkOffsetX = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Offset Y")
				.setDesc("Vertical nudge (% of image height, negative = up)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(-30, 30, 1)
					.setValue(this.plugin.settings.watermarkOffsetY)
					.onChange(async (v) => { this.plugin.settings.watermarkOffsetY = v; await this.save(); })),
		];

		this.toggle(this.watermarkTextSettings, this.plugin.settings.watermarkEnabled);

		// ── Logo watermark ────────────────────────────────────────────────────
		wmEl.createEl("h4", { text: "Logo Watermark" });

		new Setting(wmEl)
			.setName("Enable Logo Watermark")
			.addToggle((t) => t.setValue(this.plugin.settings.watermarkLogoEnabled)
				.onChange(async (v) => {
					this.plugin.settings.watermarkLogoEnabled = v;
					await this.save();
					this.toggle(this.watermarkLogoSettings, v);
				}));

		this.watermarkLogoSettings = [
			new Setting(wmEl)
				.setName("Logo Path (vault-relative)")
				.setDesc('e.g. "_assets/logo-wm.png"')
				.addText((text) =>
					text.setPlaceholder("_assets/logo-wm.png")
						.setValue(this.plugin.settings.watermarkLogoPath)
						.onChange(async (v) => { this.plugin.settings.watermarkLogoPath = v.trim(); await this.save(); })),

			new Setting(wmEl)
				.setName("Logo Size (% of image width)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(3, 50, 1)
					.setValue(this.plugin.settings.watermarkLogoSize)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoSize = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Opacity")
				.addSlider((s) => s.setDynamicTooltip().setLimits(0.05, 1.0, 0.05)
					.setValue(this.plugin.settings.watermarkLogoOpacity)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoOpacity = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Position")
				.addDropdown((d) =>
					d.addOption("bottom-right", "Bottom Right")
						.addOption("bottom-left", "Bottom Left")
						.addOption("bottom-center", "Bottom Center")
						.addOption("center", "Center")
						.setValue(this.plugin.settings.watermarkLogoPosition)
						.onChange(async (v) => { this.plugin.settings.watermarkLogoPosition = v as WatermarkPosition; await this.save(); })),

			new Setting(wmEl)
				.setName("Offset X")
				.setDesc("Horizontal nudge (% of image width)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(-30, 30, 1)
					.setValue(this.plugin.settings.watermarkLogoOffsetX)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoOffsetX = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Offset Y")
				.setDesc("Vertical nudge (% of image height)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(-30, 30, 1)
					.setValue(this.plugin.settings.watermarkLogoOffsetY)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoOffsetY = v; await this.save(); })),
		];

		this.toggle(this.watermarkLogoSettings, this.plugin.settings.watermarkLogoEnabled);

		// ── Debug (collapsed) ─────────────────────────────────────────────────
		const debugEl = this.makeSection(containerEl, "Debug", false, "bug");

		new Setting(debugEl)
			.setName("Debug Mode")
			.setDesc("Print detailed logs to the developer console (Cmd+Opt+I). Disable when not needed.")
			.addToggle((t) => t.setValue(this.plugin.settings.debugMode)
				.onChange(async (v) => { this.plugin.settings.debugMode = v; await this.plugin.saveSettings(); }));
	}
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────
// Based on AWS SDK FetchHttpHandler (Apache 2.0 License)

class ObsHttpHandler extends FetchHttpHandler {
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
		const body = method === "GET" || method === "HEAD" ? undefined : request.body;

		const transformedHeaders: Record<string, string> = {};
		for (const key of Object.keys(request.headers)) {
			const lower = key.toLowerCase();
			if (lower === "host" || lower === "content-length") continue;
			transformedHeaders[lower] = request.headers[key];
		}

		let contentType: string | undefined;
		if (transformedHeaders["content-type"]) contentType = transformedHeaders["content-type"];

		let transformedBody: string | ArrayBuffer | undefined = body;
		if (ArrayBuffer.isView(body)) transformedBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);

		const param: RequestUrlParam = {
			body: transformedBody,
			headers: transformedHeaders,
			method,
			url,
			contentType,
		};

		const raceOfPromises = [
			requestUrl(param).then((rsp) => {
				const headersLower: Record<string, string> = {};
				for (const key of Object.keys(rsp.headers)) headersLower[key.toLowerCase()] = rsp.headers[key];
				const stream = new ReadableStream<Uint8Array>({
					start(controller) { controller.enqueue(new Uint8Array(rsp.arrayBuffer)); controller.close(); },
				});
				return { response: new HttpResponse({ headers: headersLower, statusCode: rsp.status, body: stream }) };
			}),
			requestTimeout(this.requestTimeoutInMs),
		];

		if (abortSignal) {
			raceOfPromises.push(new Promise<never>((_, reject) => {
				abortSignal.onabort = () => {
					const err = new Error("Request aborted");
					err.name = "AbortError";
					reject(err);
				};
			}));
		}
		return Promise.race(raceOfPromises);
	}
}

// ── Module-level helpers ──────────────────────────────────────────────────────

const wrapTextWithPasswordHide = (text: TextComponent) => {
	const hider = text.inputEl.insertAdjacentElement("beforebegin", createSpan());
	if (!hider) return;
	setIcon(hider as HTMLElement, "eye-off");
	hider.addEventListener("click", () => {
		const isText = text.inputEl.getAttribute("type") === "text";
		setIcon(hider as HTMLElement, isText ? "eye-off" : "eye");
		text.inputEl.setAttribute("type", isText ? "password" : "text");
		text.inputEl.focus();
	});
	text.inputEl.setAttribute("type", "password");
	return text;
};

const wrapFileDependingOnType = (location: string, type: string, localBase: string) => {
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

async function generateFileHash(data: Uint8Array): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 32);
}

function matchesGlobPattern(filePath: string, pattern: string): boolean {
	if (!pattern?.trim()) return false;
	return pattern.split(",").map((p) => p.trim()).some((p) => minimatch(filePath, p));
}
