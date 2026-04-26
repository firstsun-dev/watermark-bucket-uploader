import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
	setIcon,
} from "obsidian";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { paintCheckerboard, paintLogoWatermark, paintTextWatermark, resolvePosition } from "./watermark";
import type R2UploaderPlugin from "./main";

export interface pasteFunction {
	(
		this: HTMLElement,
		event: ClipboardEvent | DragEvent,
		editor: import("obsidian").Editor,
	): void;
}

export type WatermarkPosition =
	| "bottom-right"
	| "bottom-left"
	| "bottom-center"
	| "center";

export interface R2UploaderSettings {
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
	watermarkFont: string;
	watermarkFontFamily: string;
	watermarkFontSize: number;
	watermarkBold: boolean;
	watermarkItalic: boolean;
	watermarkColor: string;
	watermarkPosition: WatermarkPosition;
	watermarkOffsetX: number;
	watermarkOffsetY: number;
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
	// Preview resolution
	previewResolution: "720p" | "1080p" | "4k" | "custom";
	previewResolutionCustom: string;
	// Debug
	debugMode: boolean;
	// Upload sequence counter
	uploadSeq: number;
}

export const DEFAULT_SETTINGS: R2UploaderSettings = {
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
	previewResolution: "1080p",
	previewResolutionCustom: "1920x1080",
	debugMode: false,
	uploadSeq: 0,
};

export const wrapTextWithPasswordHide = (text: TextComponent) => {
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

// ── Settings Tab ──────────────────────────────────────────────────────────────

export class R2UploaderSettingTab extends PluginSettingTab {
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

		const s = this.plugin.settings;
		// Resolve canvas resolution from setting
		const resMap: Record<string, [number, number]> = {
			"720p": [1280, 720],
			"1080p": [1920, 1080],
			"4k": [3840, 2160],
		};
		let W: number, H: number;
		if (s.previewResolution === "custom") {
			const parts = s.previewResolutionCustom.toLowerCase().split(/[x×,\s]+/);
			W = parseInt(parts[0]) || 1920;
			H = parseInt(parts[1]) || 1080;
		} else {
			[W, H] = resMap[s.previewResolution] ?? [1920, 1080];
		}
		// Set canvas buffer to full target resolution; CSS keeps display at 400×225
		canvas.width = W;
		canvas.height = H;
		ctx.setTransform(1, 0, 0, 1, 0, 0);

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

		if (s.watermarkLogoEnabled && s.watermarkLogoPath) {
			try {
				const logoData = await this.plugin.app.vault.adapter.readBinary(s.watermarkLogoPath);
				await paintLogoWatermark(ctx, W, H, s, logoData);
			} catch {
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

		paintTextWatermark(ctx, W, H, s);
	}

	private refreshPreview(): void {
		this.renderPreview().catch(() => {/* ignore */ });
	}

	// ── helpers ───────────────────────────────────────────────────────────────

	private save = async (): Promise<void> => {
		await this.plugin.saveSettings();
		this.refreshPreview();
	};

	private toggle(settings: Setting[], show: boolean): void {
		settings.forEach((s) => s.settingEl.toggleClass("is-hidden", !show));
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

		new Setting(containerEl).setName("Uploader").setHeading();

		this.addConnectionSection(containerEl);
		this.addUploadSection(containerEl);
		this.addImageProcessingSection(containerEl);
		this.addWatermarkSection(containerEl);
		this.addDebugSection(containerEl);
	}

	private addConnectionSection(containerEl: HTMLElement): void {
		const connEl = this.makeSection(containerEl, "Connection settings", false, "key");

		new Setting(connEl)
			.setName("Test connection")
			.setDesc("Verify S3 bucket access using current credentials.")
			.addButton((btn) => btn
				.setButtonText("Test")
				.setCta()
				.onClick(async () => {
					btn.setButtonText("Testing...").setDisabled(true);
					try {
						const client = this.plugin.s3;
						if (!client) throw new Error("S3 client not initialized");
						await client.send(new HeadBucketCommand({ Bucket: this.plugin.settings.bucket }));
						new Notice("Connection successful!");
						btn.setButtonText("Success").buttonEl.addClass("r2-btn-success");
						activeWindow.setTimeout(() => { 
							btn.setButtonText("Test").setDisabled(false); 
							btn.buttonEl.removeClass("r2-btn-success"); 
						}, 3000);
					} catch (err: unknown) {
						console.error(err);
						const message = err instanceof Error ? err.message : String(err);
						new Notice("Connection failed: " + message);
						btn.setButtonText("Failed").buttonEl.addClass("r2-btn-error");
						activeWindow.setTimeout(() => { 
							btn.setButtonText("Test").setDisabled(false); 
							btn.buttonEl.removeClass("r2-btn-error"); 
						}, 3000);
					}
				}));

		new Setting(connEl)
			.setName("Access key ID")
			.addText((text) => {
				wrapTextWithPasswordHide(text);
				text.setPlaceholder("Access key")
					.setValue(this.plugin.settings.accessKey)
					.onChange(async (v) => { this.plugin.settings.accessKey = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); });
			});

		new Setting(connEl)
			.setName("Secret key")
			.addText((text) => {
				wrapTextWithPasswordHide(text);
				text.setPlaceholder("Secret key")
					.setValue(this.plugin.settings.secretKey)
					.onChange(async (v) => { this.plugin.settings.secretKey = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); });
			});

		new Setting(connEl)
			.setName("Region")
			.setDesc('"auto" for cloudflare r2')
			.addText((text) =>
				text.setPlaceholder("Auto")
					.setValue(this.plugin.settings.region)
					.onChange(async (v) => { this.plugin.settings.region = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(connEl)
			.setName("S3 bucket")
			.addText((text) =>
				text.setPlaceholder("Bucket name")
					.setValue(this.plugin.settings.bucket)
					.onChange(async (v) => { this.plugin.settings.bucket = v.trim(); this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(connEl)
			.setName("Bucket folder")
			.setDesc("Supports ${year}, ${month}, ${day}, ${basename}")
			.addText((text) =>
				text.setPlaceholder("blog/${basename}")
					.setValue(this.plugin.settings.folder)
					.onChange(async (v) => { this.plugin.settings.folder = v.trim(); await this.plugin.saveSettings(); }));

		// Advanced connection
		const advConn = this.makeSection(connEl, "Advanced", false, "settings-2");

		new Setting(advConn)
			.setName("Use custom endpoint")
			.setDesc("Enable for cloudflare r2 or other S3-compatible providers.")
			.addToggle((t) => t.setValue(this.plugin.settings.useCustomEndpoint)
				.onChange(async (v) => { this.plugin.settings.useCustomEndpoint = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Custom endpoint URL")
			.addText((text) =>
				text.setPlaceholder("HTTPS://xxxx.r2.cloudflarestorage.com/")
					.setValue(this.plugin.settings.customEndpoint)
					.onChange(async (v) => {
						v = v.match(/^https?:\/\//) ? v : "https://" + v;
						v = v.replace(/([^/])$/, "$1/");
						this.plugin.settings.customEndpoint = v.trim();
						this.plugin.createS3Client(); await this.plugin.saveSettings();
					}));

		new Setting(advConn)
			.setName("Force path-style urls")
			.addToggle((t) => t.setValue(this.plugin.settings.forcePathStyle)
				.onChange(async (v) => { this.plugin.settings.forcePathStyle = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Use custom image URL")
			.setDesc("Override public URL base (CDN / custom domain).")
			.addToggle((t) => t.setValue(this.plugin.settings.useCustomImageUrl)
				.onChange(async (v) => { this.plugin.settings.useCustomImageUrl = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Custom image URL")
			.addText((text) =>
				text.setValue(this.plugin.settings.customImageUrl)
					.onChange(async (v) => {
						v = v.match(/^https?:\/\//) ? v : "https://" + v;
						v = v.replace(/([^/])$/, "$1/");
						this.plugin.settings.customImageUrl = v.trim();
						this.plugin.createS3Client(); await this.plugin.saveSettings();
					}));

		new Setting(advConn)
			.setName("Bypass local cors check")
			.addToggle((t) => t.setValue(this.plugin.settings.bypassCors)
				.onChange(async (v) => { this.plugin.settings.bypassCors = v; this.plugin.createS3Client(); await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Query string key")
			.addText((text) =>
				text.setPlaceholder("E.g. V")
					.setValue(this.plugin.settings.queryStringKey)
					.onChange(async (v) => { this.plugin.settings.queryStringKey = v; await this.plugin.saveSettings(); }));

		new Setting(advConn)
			.setName("Query string value")
			.addText((text) =>
				text.setPlaceholder("E.g. 1")
					.setValue(this.plugin.settings.queryStringValue)
					.onChange(async (v) => { this.plugin.settings.queryStringValue = v; await this.plugin.saveSettings(); }));
	}

	private addUploadSection(containerEl: HTMLElement): void {
		const uploadEl = this.makeSection(containerEl, "Upload settings", true, "upload");

		new Setting(uploadEl)
			.setName("Upload on drag")
			.setDesc("Also upload images dropped into the editor.")
			.addToggle((t) => t.setValue(this.plugin.settings.uploadOnDrag)
				.onChange(async (v) => { this.plugin.settings.uploadOnDrag = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl).setName("Upload video files").addToggle((t) =>
			t.setValue(this.plugin.settings.uploadVideo).onChange(async (v) => { this.plugin.settings.uploadVideo = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl).setName("Upload audio files").addToggle((t) =>
			t.setValue(this.plugin.settings.uploadAudio).onChange(async (v) => { this.plugin.settings.uploadAudio = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl).setName("Upload PDF files").addToggle((t) =>
			t.setValue(this.plugin.settings.uploadPdf).onChange(async (v) => { this.plugin.settings.uploadPdf = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Copy to local folder instead")
			.addToggle((t) => t.setValue(this.plugin.settings.localUpload)
				.onChange(async (v) => { this.plugin.settings.localUpload = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Local folder path")
			.addText((text) =>
				text.setPlaceholder("Folder").setValue(this.plugin.settings.localUploadFolder)
					.onChange(async (v) => { this.plugin.settings.localUploadFolder = v.trim(); await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Disable auto-upload on file create")
			.setDesc("Prevent uploads when files are created by sync tools.")
			.addToggle((t) => t.setValue(this.plugin.settings.disableAutoUploadOnCreate)
				.onChange(async (v) => { this.plugin.settings.disableAutoUploadOnCreate = v; await this.plugin.saveSettings(); }));

		new Setting(uploadEl)
			.setName("Ignore pattern")
			.setDesc("Glob patterns to skip, comma-separated. E.g. Private/*, **/drafts/**")
			.addText((text) =>
				text.setPlaceholder("Private/*, **/drafts/**")
					.setValue(this.plugin.settings.ignorePattern)
					.onChange(async (v) => { this.plugin.settings.ignorePattern = v.trim(); await this.plugin.saveSettings(); }));
	}

	private addImageProcessingSection(containerEl: HTMLElement): void {
		const imgEl = this.makeSection(containerEl, "Image processing", true, "image");

		new Setting(imgEl)
			.setName("Convert to webp")
			.setDesc("Convert images to webp before uploading. Filename becomes .webp.")
			.addToggle((t) => t.setValue(this.plugin.settings.convertToWebP)
				.onChange(async (v) => { this.plugin.settings.convertToWebP = v; await this.plugin.saveSettings(); }));

		new Setting(imgEl)
			.setName("Webp quality")
			.setDesc("0.1 (small file) — 1.0 (best quality). Default: 0.85")
			.addSlider((s) => s.setDynamicTooltip().setLimits(0.1, 1.0, 0.05)
				.setValue(this.plugin.settings.webpQuality)
				.onChange(async (v) => { this.plugin.settings.webpQuality = v; await this.plugin.saveSettings(); }));

		new Setting(imgEl)
			.setName("Enable compression")
			.addToggle((t) => t.setValue(this.plugin.settings.enableImageCompression)
				.onChange(async (v) => {
					this.plugin.settings.enableImageCompression = v;
					await this.plugin.saveSettings();
					this.toggle(this.compressionSettings, v);
				}));

		this.compressionSettings = [
			new Setting(imgEl)
				.setName("Max size (mb)")
				.addText((text) =>
					text.setPlaceholder("1").setValue(this.plugin.settings.maxImageCompressionSize.toString())
						.onChange(async (v) => {
							const n = parseFloat(v);
							if (!isNaN(n) && n > 0) { this.plugin.settings.maxImageCompressionSize = n; await this.plugin.saveSettings(); }
						})),

			new Setting(imgEl)
				.setName("Compression quality")
				.addSlider((s) => s.setDynamicTooltip().setLimits(0.0, 1.0, 0.05)
					.setValue(this.plugin.settings.imageCompressionQuality)
					.onChange(async (v) => { this.plugin.settings.imageCompressionQuality = v; await this.plugin.saveSettings(); })),

			new Setting(imgEl)
				.setName("Max width / height (px)")
				.addText((text) =>
					text.setPlaceholder("4096").setValue(this.plugin.settings.maxImageWidthOrHeight.toString())
						.onChange(async (v) => {
							const n = parseInt(v);
							if (!isNaN(n) && n > 0) { this.plugin.settings.maxImageWidthOrHeight = n; await this.plugin.saveSettings(); }
						})),
		];
		this.toggle(this.compressionSettings, this.plugin.settings.enableImageCompression);
	}

	private addWatermarkSection(containerEl: HTMLElement): void {
		const wmEl = this.makeSection(containerEl, "Watermark", true, "stamp");

		const previewWrap = wmEl.createDiv({ cls: "r2-preview-wrap" });
		this.previewCanvas = previewWrap.createEl("canvas", { cls: "r2-preview-canvas" });

		const bgSetting = new Setting(previewWrap)
			.setName("Preview background")
			.setClass("r2-preview-bg-setting")
			.addDropdown((d) =>
				d.addOptions({ checker: "Checkered", white: "White", black: "Black", custom: "Custom color" })
					.setValue(this.plugin.settings.previewBackground)
					.onChange(async (v: string) => {
						this.plugin.settings.previewBackground = v as R2UploaderSettings["previewBackground"];
						await this.plugin.saveSettings();
						customColorSetting.settingEl.toggleClass("is-hidden", v !== "custom");
						this.refreshPreview();
					}));
		void bgSetting;

		const customColorSetting = new Setting(previewWrap)
			.setName("Background color");

		if (customColorSetting.addColorPicker) {
			customColorSetting.addColorPicker((cp) =>
				cp.setValue(this.plugin.settings.previewBackgroundColor)
					.onChange(async (v) => {
						this.plugin.settings.previewBackgroundColor = v;
						await this.plugin.saveSettings();
						this.refreshPreview();
					}));
		}
		customColorSetting.settingEl.toggleClass("is-hidden", this.plugin.settings.previewBackground !== "custom");

		// Preview resolution control
		const resSetting = new Setting(previewWrap)
			.setName("Preview resolution")
			.setDesc("Canvas resolution for the watermark preview. Higher = more accurate proportions.")
			.addDropdown((d) =>
				d.addOptions({
					"720p": "720p (1280×720)",
					"1080p": "1080p (1920×1080)",
					"4k": "4k (3840×2160)",
					"custom": "Custom…",
				})
					.setValue(this.plugin.settings.previewResolution)
					.onChange(async (v: string) => {
						this.plugin.settings.previewResolution = v as R2UploaderSettings["previewResolution"];
						await this.plugin.saveSettings();
						customResSetting.settingEl.toggleClass("is-hidden", v !== "custom");
						this.refreshPreview();
					}));
		void resSetting;

		const customResSetting = new Setting(previewWrap)
			.setName("Custom resolution")
			.setDesc('Width × height in pixels, e.g. "2560x1440"')
			.addText((t) =>
				t.setPlaceholder("1920X1080")
					.setValue(this.plugin.settings.previewResolutionCustom)
					.onChange(async (v) => {
						this.plugin.settings.previewResolutionCustom = v.trim();
						await this.plugin.saveSettings();
						this.refreshPreview();
					}));
		customResSetting.settingEl.toggleClass("is-hidden", this.plugin.settings.previewResolution !== "custom");

		const resLabels: Record<string, string> = { "720p": "1280×720", "1080p": "1920×1080", "4k": "3840×2160" };
		previewWrap.createEl("p", {
			text: `Preview (${resLabels[this.plugin.settings.previewResolution] ?? this.plugin.settings.previewResolutionCustom})`,
			cls: "r2-preview-label"
		});
		this.refreshPreview();

		// ── Text watermark ────────────────────────────────────────────────────
		new Setting(wmEl).setName("Text watermark").setHeading();

		new Setting(wmEl)
			.setName("Enable text watermark")
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
				.setName("Font family")
				.setDesc('E.g. "arial", "georgia", "monospace"')
				.addText((text) =>
					text.setPlaceholder("Arial")
						.setValue(this.plugin.settings.watermarkFontFamily)
						.onChange(async (v) => { this.plugin.settings.watermarkFontFamily = v || "Arial"; await this.save(); })),

			new Setting(wmEl)
				.setName("Font size (px)")
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
					text.setPlaceholder("Rgba(255,255,255,0.85)")
						.setValue(this.plugin.settings.watermarkColor)
						.onChange(async (v) => { this.plugin.settings.watermarkColor = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Position")
				.addDropdown((d) =>
					d.addOption("bottom-right", "Bottom right")
						.addOption("bottom-left", "Bottom left")
						.addOption("bottom-center", "Bottom center")
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
				.setName("Offset y")
				.setDesc("Vertical nudge (% of image height, negative = up)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(-30, 30, 1)
					.setValue(this.plugin.settings.watermarkOffsetY)
					.onChange(async (v) => { this.plugin.settings.watermarkOffsetY = v; await this.save(); })),
		];

		this.toggle(this.watermarkTextSettings, this.plugin.settings.watermarkEnabled);

		// ── Logo watermark ────────────────────────────────────────────────────
		new Setting(wmEl).setName("Logo watermark").setHeading();

		new Setting(wmEl)
			.setName("Enable logo watermark")
			.addToggle((t) => t.setValue(this.plugin.settings.watermarkLogoEnabled)
				.onChange(async (v) => {
					this.plugin.settings.watermarkLogoEnabled = v;
					await this.save();
					this.toggle(this.watermarkLogoSettings, v);
				}));

		this.watermarkLogoSettings = [
			new Setting(wmEl)
				.setName("Logo path (vault-relative)")
				.setDesc('e.g. "_assets/logo-wm.png"')
				.addText((text) => {
					text.setPlaceholder("_assets/logo-wm.png")
						.setValue(this.plugin.settings.watermarkLogoPath)
						.onChange(async (v) => {
							const trimmed = v.trim();
							this.plugin.settings.watermarkLogoPath = trimmed;
							await this.save();
							const setting = text.inputEl.closest(".setting-item");
							const descEl = setting?.querySelector(".setting-item-description") as HTMLElement;
							if (!descEl) return;
							if (!trimmed) {
								descEl.textContent = 'e.g. "_assets/logo-wm.png"';
								descEl.removeClass("r2-success", "r2-error");
								return;
							}
							const exists = await this.plugin.app.vault.adapter.exists(trimmed);
							descEl.textContent = exists ? "✓ File found" : "⚠ File not found in vault";
							descEl.toggleClass("r2-success", exists);
							descEl.toggleClass("r2-error", !exists);
						});
				}),

			new Setting(wmEl)
				.setName("Logo size (% of image width)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(1, 50, 1)
					.setValue(this.plugin.settings.watermarkLogoSize)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoSize = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Logo opacity")
				.addSlider((s) => s.setDynamicTooltip().setLimits(0.0, 1.0, 0.05)
					.setValue(this.plugin.settings.watermarkLogoOpacity)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoOpacity = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Position")
				.addDropdown((d) =>
					d.addOption("bottom-right", "Bottom right")
						.addOption("bottom-left", "Bottom left")
						.addOption("bottom-center", "Bottom center")
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
				.setName("Offset y")
				.setDesc("Vertical nudge (% of image height)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(-30, 30, 1)
					.setValue(this.plugin.settings.watermarkLogoOffsetY)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoOffsetY = v; await this.save(); })),
		];

		this.toggle(this.watermarkLogoSettings, this.plugin.settings.watermarkLogoEnabled);
	}

	private addDebugSection(containerEl: HTMLElement): void {
		const debugEl = this.makeSection(containerEl, "Debug", false, "bug");

		new Setting(debugEl)
			.setName("Debug mode")
			.setDesc("Print detailed logs to the developer console (Cmd+Opt+I). Disable when not needed.")
			.addToggle((t) => t.setValue(this.plugin.settings.debugMode)
				.onChange(async (v) => { this.plugin.settings.debugMode = v; await this.plugin.saveSettings(); }));
	}
}
