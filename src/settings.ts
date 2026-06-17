import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
	setIcon,
	setTooltip,
} from "obsidian";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { paintCheckerboard, paintLogoWatermark, paintTextWatermark, resolvePosition } from "./watermark";
import type R2UploaderPlugin from "./main";

export interface PasteFunction {
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
	watermarkTextEnabled: boolean;
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
	// Persisted open/closed state of collapsible settings sections, keyed by label
	sectionState: Record<string, boolean>;
	// Plugin version the user last saw an onboarding/changelog modal for
	lastSeenVersion: string;
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
	watermarkTextEnabled: false,
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
	sectionState: {},
	lastSeenVersion: "",
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

const REFRESH_TIMEOUT = 3000;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const PADDING_FACTOR = 0.015;

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
			W = parseInt(parts[0]) || DEFAULT_CANVAS_WIDTH;
			H = parseInt(parts[1]) || DEFAULT_CANVAS_HEIGHT;
		} else {
			[W, H] = resMap[s.previewResolution] ?? [DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT];
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
				const padding = Math.round(W * PADDING_FACTOR);
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
		this.renderPreview().catch((e) => {
			if (this.plugin.settings.debugMode) {
				console.debug("[R2Uploader] Preview render failed:", e);
			}
		});
	}

	// ── helpers ───────────────────────────────────────────────────────────────

	private save = async (): Promise<void> => {
		await this.plugin.saveSettings();
		this.refreshPreview();
	};

	private toggle(settings: Setting[], show: boolean): void {
		settings.forEach((s) => s.settingEl.toggleClass("is-hidden", !show));
	}

	/** Adds a "?" icon next to a setting's name that shows explanatory text on hover (desktop) or tap (mobile). */
	private addInfoTooltip(setting: Setting, text: string): void {
		const icon = setting.nameEl.createSpan({ cls: "r2-info-icon" });
		setIcon(icon, "help-circle");
		setTooltip(icon, text, { placement: "top" });
		icon.addEventListener("click", (evt) => {
			evt.stopPropagation();
			this.showInfoPopover(icon, text);
		});
	}

	private showInfoPopover(anchor: HTMLElement, text: string): void {
		activeDocument.querySelectorAll(".r2-info-popover").forEach((el) => el.remove());
		const popover = activeDocument.body.createDiv({ cls: "r2-info-popover", text });
		const rect = anchor.getBoundingClientRect();
		popover.style.top = `${rect.bottom + 4}px`;
		popover.style.left = `${rect.left}px`;
		const close = (evt: MouseEvent) => {
			if (!popover.contains(evt.target as Node)) {
				popover.remove();
				activeDocument.removeEventListener("click", close);
			}
		};
		activeWindow.setTimeout(() => activeDocument.addEventListener("click", close), 0);
	}

	private setFieldValid(inputEl: HTMLElement, valid: boolean): void {
		inputEl.toggleClass("r2-input-error", !valid);
	}

	private makeSection(
		parent: HTMLElement,
		label: string,
		open = false,
		icon?: string,
	): HTMLElement {
		const isOpen = this.plugin.settings.sectionState[label] ?? open;
		const details = parent.createEl("details", { cls: "r2-section" });
		if (isOpen) details.setAttribute("open", "");
		details.addEventListener("toggle", () => {
			this.plugin.settings.sectionState[label] = details.open;
			void this.plugin.saveSettings();
		});
		const summary = details.createEl("summary", { cls: "r2-section-summary" });
		if (icon) {
			const iconEl = summary.createSpan({ cls: "r2-section-icon" });
			setIcon(iconEl, icon);
		}
		summary.createSpan({ text: label });
		const chevronEl = summary.createSpan({ cls: "r2-chevron" });
		setIcon(chevronEl, "chevron-right");
		return details;
	}

	private addStringSetting(
		container: HTMLElement,
		name: string,
		desc: string,
		placeholder: string,
		key: Exclude<keyof R2UploaderSettings, "sectionState">,
		password = false,
		onChanged?: () => void,
	): Setting {
		return new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				if (password) wrapTextWithPasswordHide(text);
				text.setPlaceholder(placeholder)
					.setValue(String(this.plugin.settings[key]))
					.onChange(async (v) => {
						(this.plugin.settings[key] as string) = v.trim();
						if (onChanged) onChanged();
						await this.plugin.saveSettings();
					});
			});
	}

	private addToggleSetting(
		container: HTMLElement,
		name: string,
		desc: string,
		key: keyof R2UploaderSettings,
		onChanged?: (v: boolean) => void,
	): Setting {
		return new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addToggle((t) => t.setValue(!!this.plugin.settings[key])
				.onChange(async (v) => {
					(this.plugin.settings[key] as boolean) = v;
					if (onChanged) onChanged(v);
					await this.plugin.saveSettings();
				}));
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
						}, REFRESH_TIMEOUT);
					} catch (err: unknown) {
						console.error(err);
						const message = err instanceof Error ? err.message : String(err);
						new Notice("Connection failed: " + message);
						btn.setButtonText("Failed").buttonEl.addClass("r2-btn-error");
						activeWindow.setTimeout(() => {
							btn.setButtonText("Test").setDisabled(false);
							btn.buttonEl.removeClass("r2-btn-error");
						}, REFRESH_TIMEOUT);
					}
				}));

		const updateS3 = () => this.plugin.createS3Client();

		this.addInfoTooltip(
			this.addStringSetting(connEl, "Access key ID", "", "Access key", "accessKey", true, updateS3),
			"Access key from your S3-compatible provider (e.g. AWS IAM user, R2 API token).",
		);
		this.addInfoTooltip(
			this.addStringSetting(connEl, "Secret key", "", "Secret key", "secretKey", true, updateS3),
			"Secret key paired with the access key ID above. Hidden by default.",
		);
		this.addStringSetting(connEl, "Region", '"auto" for cloudflare r2', "Auto", "region", false, updateS3);
		this.addInfoTooltip(
			this.addStringSetting(connEl, "S3 bucket", "", "Bucket name", "bucket", false, updateS3),
			"Name of the bucket uploads are sent to. Must match exactly what exists in your provider.",
		);
		this.addStringSetting(connEl, "Bucket folder", "Supports ${year}, ${month}, ${day}, ${basename}", "blog/${basename}", "folder");

		// Advanced connection
		const advConn = this.makeSection(connEl, "Advanced settings", false, "settings-2");

		this.addToggleSetting(advConn, "Use custom endpoint", "Enable for cloudflare r2 or other S3-compatible providers.", "useCustomEndpoint", updateS3);

		const endpointSetting = new Setting(advConn)
			.setName("Custom endpoint URL")
			.addText((text) =>
				text.setPlaceholder("HTTPS://xxxx.r2.cloudflarestorage.com/")
					.setValue(this.plugin.settings.customEndpoint)
					.onChange(async (v) => {
						let normalized = /^https?:\/\//.test(v) ? v : "https://" + v;
						normalized = normalized.replace(/([^/])$/, "$1/");
						normalized = normalized.trim();
						this.plugin.settings.customEndpoint = normalized;
						this.setFieldValid(text.inputEl, !v.trim() || this.isValidUrl(normalized));
						updateS3(); await this.plugin.saveSettings();
					}));
		this.addInfoTooltip(endpointSetting, "S3-compatible API endpoint, e.g. https://<account-id>.r2.cloudflarestorage.com/");

		this.addInfoTooltip(
			this.addToggleSetting(advConn, "Force path-style urls", "", "forcePathStyle", updateS3),
			"Use https://endpoint/bucket instead of https://bucket.endpoint. Required by some S3-compatible services (e.g. MinIO).",
		);
		this.addToggleSetting(advConn, "Use custom image URL", "Override public URL base (CDN / custom domain).", "useCustomImageUrl", updateS3);

		const imageUrlSetting = new Setting(advConn)
			.setName("Custom image URL")
			.addText((text) =>
				text.setValue(this.plugin.settings.customImageUrl)
					.onChange(async (v) => {
						let normalized = /^https?:\/\//.test(v) ? v : "https://" + v;
						normalized = normalized.replace(/([^/])$/, "$1/");
						normalized = normalized.trim();
						this.plugin.settings.customImageUrl = normalized;
						this.setFieldValid(text.inputEl, !v.trim() || this.isValidUrl(normalized));
						updateS3(); await this.plugin.saveSettings();
					}));
		this.addInfoTooltip(imageUrlSetting, "Public base URL used to build image links, e.g. a CDN or custom domain. Leave blank to use the bucket's default URL.");

		this.addInfoTooltip(
			this.addToggleSetting(advConn, "Bypass local cors check", "", "bypassCors", updateS3),
			"Skip the local CORS preflight check. Enable if uploads fail locally due to CORS but your bucket is actually configured correctly.",
		);
		this.addInfoTooltip(
			this.addStringSetting(advConn, "Query string key", "", "E.g. V", "queryStringKey"),
			"Name of a query parameter appended to every uploaded image URL, e.g. for CDN cache-busting.",
		);
		this.addInfoTooltip(
			this.addStringSetting(advConn, "Query string value", "", "E.g. 1", "queryStringValue"),
			"Value paired with the query string key above.",
		);
	}

	private isValidUrl(value: string): boolean {
		try {
			new URL(value);
			return true;
		} catch {
			return false;
		}
	}

	private isValidResolution(value: string): boolean {
		const parts = value.toLowerCase().split(/[x×,\s]+/).filter(Boolean);
		if (parts.length !== 2) return false;
		const [w, h] = parts.map((p) => parseInt(p, 10));
		return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
	}

	private addUploadSection(containerEl: HTMLElement): void {
		const uploadEl = this.makeSection(containerEl, "Upload settings", true, "upload");

		this.addToggleSetting(uploadEl, "Upload on drag", "Also upload images dropped into the editor.", "uploadOnDrag");
		this.addToggleSetting(uploadEl, "Upload video files", "", "uploadVideo");
		this.addToggleSetting(uploadEl, "Upload audio files", "", "uploadAudio");
		this.addToggleSetting(uploadEl, "Upload PDF files", "", "uploadPdf");
		this.addInfoTooltip(
			this.addToggleSetting(uploadEl, "Copy to local folder instead", "", "localUpload"),
			"Save images into a vault folder instead of uploading to the S3 bucket.",
		);
		this.addInfoTooltip(
			this.addStringSetting(uploadEl, "Local folder path", "", "Folder", "localUploadFolder"),
			"Vault-relative folder used when 'Copy to local folder instead' is enabled.",
		);
		this.addToggleSetting(uploadEl, "Disable auto-upload on file create", "Prevent uploads when files are created by sync tools.", "disableAutoUploadOnCreate");
		this.addStringSetting(uploadEl, "Ignore pattern", "Glob patterns to skip, comma-separated. E.g. Private/*, **/drafts/**", "Private/*, **/drafts/**", "ignorePattern");
	}

	private addImageProcessingSection(containerEl: HTMLElement): void {
		const imgEl = this.makeSection(containerEl, "Image processing", true, "image");

		this.addToggleSetting(imgEl, "Convert to webp", "Convert images to webp before uploading. Filename becomes .webp.", "convertToWebP");

		new Setting(imgEl)
			.setName("Webp quality")
			.setDesc("0.1 (small file) — 1.0 (best quality). Default: 0.85")
			.addSlider((s) => s.setDynamicTooltip().setLimits(0.1, 1.0, 0.05)
				.setValue(this.plugin.settings.webpQuality)
				.onChange(async (v) => { this.plugin.settings.webpQuality = v; await this.plugin.saveSettings(); }));

		this.addToggleSetting(imgEl, "Enable compression", "", "enableImageCompression", (v) => {
			this.toggle(this.compressionSettings, v);
		});

		const maxSizeSetting = new Setting(imgEl)
			.setName("Max size (mb)")
			.addText((text) =>
				text.setPlaceholder("1").setValue(this.plugin.settings.maxImageCompressionSize.toString())
					.onChange(async (v) => {
						const n = parseFloat(v);
						const valid = !isNaN(n) && n > 0;
						this.setFieldValid(text.inputEl, valid);
						if (valid) { this.plugin.settings.maxImageCompressionSize = n; await this.plugin.saveSettings(); }
					}));
		this.addInfoTooltip(maxSizeSetting, "Compression keeps reducing quality until the file is under this size.");

		const compressionQualitySetting = new Setting(imgEl)
			.setName("Compression quality")
			.addSlider((s) => s.setDynamicTooltip().setLimits(0.0, 1.0, 0.05)
				.setValue(this.plugin.settings.imageCompressionQuality)
				.onChange(async (v) => { this.plugin.settings.imageCompressionQuality = v; await this.plugin.saveSettings(); }));
		this.addInfoTooltip(compressionQualitySetting, "Starting quality used for compression before the max-size limit kicks in.");

		const maxDimensionSetting = new Setting(imgEl)
			.setName("Max width / height (px)")
			.addText((text) =>
				text.setPlaceholder("4096").setValue(this.plugin.settings.maxImageWidthOrHeight.toString())
					.onChange(async (v) => {
						const n = parseInt(v);
						const valid = !isNaN(n) && n > 0;
						this.setFieldValid(text.inputEl, valid);
						if (valid) { this.plugin.settings.maxImageWidthOrHeight = n; await this.plugin.saveSettings(); }
					}));
		this.addInfoTooltip(maxDimensionSetting, "Images wider or taller than this (in pixels) are scaled down proportionally.");

		this.compressionSettings = [maxSizeSetting, compressionQualitySetting, maxDimensionSetting];
		this.toggle(this.compressionSettings, this.plugin.settings.enableImageCompression);
	}

	private addWatermarkSection(containerEl: HTMLElement): void {
		const wmEl = this.makeSection(containerEl, "Watermark", true, "stamp");

		const previewWrap = wmEl.createDiv({ cls: "r2-preview-wrap" });
		this.previewCanvas = previewWrap.createEl("canvas", { cls: "r2-preview-canvas" });

		const customColorSetting = new Setting(previewWrap).setName("Background color");

		new Setting(previewWrap)
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

		const customResSetting = new Setting(previewWrap)
			.setName("Custom resolution")
			.setDesc('Width × height in pixels, e.g. "2560x1440"');

		// Preview resolution control
		new Setting(previewWrap)
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

		customResSetting.addText((t) =>
				t.setPlaceholder("1920X1080")
					.setValue(this.plugin.settings.previewResolutionCustom)
					.onChange(async (v) => {
						const trimmed = v.trim();
						this.plugin.settings.previewResolutionCustom = trimmed;
						this.setFieldValid(t.inputEl, this.isValidResolution(trimmed));
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

		this.addTextWatermarkSubSection(wmEl);
		this.addLogoWatermarkSubSection(wmEl);
	}

	private addTextWatermarkSubSection(wmEl: HTMLElement): void {
		new Setting(wmEl).setName("Text watermark").setHeading();

		this.addToggleSetting(wmEl, "Enable text watermark", "", "watermarkTextEnabled", (v) => {
			this.toggle(this.watermarkTextSettings, v);
			this.refreshPreview();
		});

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

		this.toggle(this.watermarkTextSettings, this.plugin.settings.watermarkTextEnabled);
	}

	private addLogoWatermarkSubSection(wmEl: HTMLElement): void {
		new Setting(wmEl).setName("Logo watermark").setHeading();

		this.addToggleSetting(wmEl, "Enable logo watermark", "", "watermarkLogoEnabled", (v) => {
			this.toggle(this.watermarkLogoSettings, v);
			this.refreshPreview();
		});

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
		this.addToggleSetting(debugEl, "Debug mode", "Print detailed logs to the developer console (Cmd+Opt+I). Disable when not needed.", "debugMode");
	}
}
