import {
	App,
	PluginSettingTab,
	Setting,
	TextComponent,
	setIcon,
} from "obsidian";
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
	// Debug
	debugMode: boolean;
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
	debugMode: false,
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
		const dpr = window.devicePixelRatio || 1;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const W = 400;
		const H = 225;
		const s = this.plugin.settings;

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
			} catch (_) {
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

		// ── Upload (open) ─────────────────────────────────────────────────────
		const uploadEl = this.makeSection(containerEl, "Upload Settings", true, "upload");

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

		const previewWrap = wmEl.createDiv({ cls: "r2-preview-wrap" });
		this.previewCanvas = previewWrap.createEl("canvas", { cls: "r2-preview-canvas" });
		const dpr = window.devicePixelRatio || 1;
		this.previewCanvas.width = 400 * dpr;
		this.previewCanvas.height = 225 * dpr;
		this.previewCanvas.style.width = "400px";
		this.previewCanvas.style.height = "225px";

		// eslint-disable-next-line prefer-const
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
				.addText((text) => {
					text.setPlaceholder("_assets/logo-wm.png")
						.setValue(this.plugin.settings.watermarkLogoPath)
						.onChange(async (v) => {
							const trimmed = v.trim();
							this.plugin.settings.watermarkLogoPath = trimmed;
							await this.save();
							const setting = text.inputEl.closest(".setting-item");
							const descEl = setting?.querySelector(".setting-item-description");
							if (!descEl) return;
							if (!trimmed) {
								descEl.textContent = 'e.g. "_assets/logo-wm.png"';
								descEl.removeAttribute("style");
								return;
							}
							const exists = await this.plugin.app.vault.adapter.exists(trimmed);
							if (exists) {
								descEl.textContent = "✓ File found";
								(descEl as HTMLElement).style.color = "var(--color-green)";
							} else {
								descEl.textContent = "⚠ File not found in vault";
								(descEl as HTMLElement).style.color = "var(--color-red)";
							}
						});
				}),

			new Setting(wmEl)
				.setName("Logo Size (% of image width)")
				.addSlider((s) => s.setDynamicTooltip().setLimits(1, 50, 1)
					.setValue(this.plugin.settings.watermarkLogoSize)
					.onChange(async (v) => { this.plugin.settings.watermarkLogoSize = v; await this.save(); })),

			new Setting(wmEl)
				.setName("Logo Opacity")
				.addSlider((s) => s.setDynamicTooltip().setLimits(0.0, 1.0, 0.05)
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
