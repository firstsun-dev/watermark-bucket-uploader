import { AbstractInputSuggest, Setting, TFile } from "obsidian";
import type { SettingsContext } from "../context";
import type { R2UploaderSettings } from "../types";
import { paintCheckerboard, paintLogoWatermark, paintTextWatermark } from "../../watermark";

const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const RES_MAP: Record<string, [number, number]> = {
	"720p": [1280, 720],
	"1080p": [1920, 1080],
	"4k": [3840, 2160],
};
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"];

/** Element id the "Choose another file" logo-error button focuses — kept in sync with watermark-section.ts. */
const LOGO_PATH_INPUT_ID = "r2-watermark-logo-path-input";

class VaultImageSuggest extends AbstractInputSuggest<TFile> {
	constructor(
		private ctx: SettingsContext,
		inputEl: HTMLInputElement,
		private onPick: (file: TFile) => void,
	) {
		super(ctx.app, inputEl);
	}

	protected getSuggestions(query: string): TFile[] {
		const q = query.toLowerCase();
		return this.ctx.app.vault
			.getFiles()
			.filter((f) => IMAGE_EXTENSIONS.includes(f.extension.toLowerCase()))
			.filter((f) => f.path.toLowerCase().includes(q))
			.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.setValue(file.path);
		this.onPick(file);
		this.close();
	}
}

function resolveResolution(s: R2UploaderSettings): { W: number; H: number } {
	if (s.previewResolution === "custom") {
		const parts = s.previewResolutionCustom.toLowerCase().split(/[x×,\s]+/);
		const W = parseInt(parts[0], 10) || DEFAULT_CANVAS_WIDTH;
		const H = parseInt(parts[1], 10) || DEFAULT_CANVAS_HEIGHT;
		return { W, H };
	}
	const [W, H] = RES_MAP[s.previewResolution] ?? [DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT];
	return { W, H };
}

function drawBackground(cctx: CanvasRenderingContext2D, W: number, H: number, s: R2UploaderSettings): void {
	const bg = s.previewBackground;
	if (bg === "checker") {
		paintCheckerboard(cctx, W, H);
	} else if (bg === "white") {
		cctx.fillStyle = "#ffffff";
		cctx.fillRect(0, 0, W, H);
	} else if (bg === "black") {
		cctx.fillStyle = "#000000";
		cctx.fillRect(0, 0, W, H);
	} else {
		cctx.fillStyle = s.previewBackgroundColor || "#888888";
		cctx.fillRect(0, 0, W, H);
	}
}

function drawImageCover(cctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number): void {
	const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
	const dw = img.naturalWidth * scale;
	const dh = img.naturalHeight * scale;
	const dx = (W - dw) / 2;
	const dy = (H - dh) / 2;
	cctx.drawImage(img, dx, dy, dw, dh);
}

function loadImage(data: ArrayBuffer, path: string): Promise<HTMLImageElement> {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	let mimeType = "image/png";
	if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
	else if (ext === "webp") mimeType = "image/webp";
	else if (ext === "svg") mimeType = "image/svg+xml";
	else if (ext === "gif") mimeType = "image/gif";
	else if (ext === "bmp") mimeType = "image/bmp";

	return new Promise((resolve, reject) => {
		const blob = new Blob([data], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Sample image load failed"));
		};
		img.src = url;
	});
}

/** Draws the "sample photo" layer on top of the background. Falls through to background on failure. */
async function drawSampleImage(
	cctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	s: R2UploaderSettings,
	ctx: SettingsContext,
): Promise<void> {
	const sample = s.previewSampleImage;
	if (sample === "checker") {
		paintCheckerboard(cctx, W, H);
		return;
	}
	if (sample === "light") {
		const grad = cctx.createLinearGradient(0, 0, W, H);
		grad.addColorStop(0, "#f7f7f4");
		grad.addColorStop(1, "#d9d9d2");
		cctx.fillStyle = grad;
		cctx.fillRect(0, 0, W, H);
		return;
	}
	if (sample === "dark") {
		const grad = cctx.createLinearGradient(0, 0, W, H);
		grad.addColorStop(0, "#2c2c33");
		grad.addColorStop(1, "#0f0f12");
		cctx.fillStyle = grad;
		cctx.fillRect(0, 0, W, H);
		return;
	}
	// sample === "vault"
	if (!s.previewSampleImagePath) return; // nothing chosen yet — background shows through
	try {
		const data = await ctx.app.vault.adapter.readBinary(s.previewSampleImagePath);
		const img = await loadImage(data, s.previewSampleImagePath);
		drawImageCover(cctx, img, W, H);
	} catch {
		// Leave the background visible; this mirrors the "no gray placeholder box" rule for logos.
		if (s.debugMode) console.debug("[R2Uploader] Preview sample image failed to load");
	}
}

/**
 * Renders the watermark preview panel: toolbar (sample image / background / resolution),
 * canvas, and a resolution-aware label. Registers the paint routine via
 * ctx.setPreviewRenderer so any change elsewhere in the settings tab can trigger a repaint
 * through ctx.refreshPreview().
 */
export function renderWatermarkPreview(container: HTMLElement, ctx: SettingsContext): void {
	const s = ctx.plugin.settings;
	const panel = container.createDiv({ cls: "r2-preview-panel" });

	// ── toolbar ──────────────────────────────────────────────────────────────

	const toolbar = panel.createDiv({ cls: "r2-preview-toolbar" });

	const sampleItem = toolbar.createDiv({ cls: "r2-preview-toolbar-item" });
	const vaultPathSetting = new Setting(toolbar)
		.setName("Vault image path")
		.setClass("r2-preview-toolbar-item r2-preview-vault-path");

	new Setting(sampleItem)
		.setName("Sample image")
		.addDropdown((d) =>
			d
				.addOptions({ light: "Light", dark: "Dark", checker: "Checkered", vault: "Use vault image…" })
				.setValue(s.previewSampleImage)
				.onChange(async (v) => {
					s.previewSampleImage = v as R2UploaderSettings["previewSampleImage"];
					vaultPathSetting.settingEl.toggleClass("is-hidden", v !== "vault");
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	vaultPathSetting.addText((text) => {
		text
			.setPlaceholder("_assets/sample.jpg")
			.setValue(s.previewSampleImagePath)
			.onChange((v) => {
				s.previewSampleImagePath = v.trim();
				ctx.debouncedSave();
				ctx.refreshPreview();
			});
		// eslint-disable-next-line sonarjs/constructor-for-side-effects -- attaches an input suggest dropdown; no reference needed
		new VaultImageSuggest(ctx, text.inputEl, (file) => {
			s.previewSampleImagePath = file.path;
			void ctx.save();
			ctx.refreshPreview();
		});
	});
	vaultPathSetting.settingEl.toggleClass("is-hidden", s.previewSampleImage !== "vault");

	const bgItem = toolbar.createDiv({ cls: "r2-preview-toolbar-item" });
	const customColorSetting = new Setting(toolbar).setName("Background color").setClass("r2-preview-toolbar-item");

	new Setting(bgItem)
		.setName("Background")
		.addDropdown((d) =>
			d
				.addOptions({ checker: "Checkered", white: "White", black: "Black", custom: "Custom color" })
				.setValue(s.previewBackground)
				.onChange(async (v) => {
					s.previewBackground = v as R2UploaderSettings["previewBackground"];
					customColorSetting.settingEl.toggleClass("is-hidden", v !== "custom");
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	if (customColorSetting.addColorPicker) {
		customColorSetting.addColorPicker((cp) =>
			cp.setValue(s.previewBackgroundColor).onChange(async (v) => {
				s.previewBackgroundColor = v;
				await ctx.save();
				ctx.refreshPreview();
			}),
		);
	}
	customColorSetting.settingEl.toggleClass("is-hidden", s.previewBackground !== "custom");

	const resItem = toolbar.createDiv({ cls: "r2-preview-toolbar-item" });
	const customResSetting = new Setting(toolbar)
		.setName("Custom resolution")
		.setDesc('Width × height in pixels, e.g. "2560x1440"')
		.setClass("r2-preview-toolbar-item");

	new Setting(resItem)
		.setName("Resolution")
		.addDropdown((d) =>
			d
				.addOptions({
					"720p": "720p (1280×720)",
					"1080p": "1080p (1920×1080)",
					"4k": "4k (3840×2160)",
					custom: "Custom…",
				})
				.setValue(s.previewResolution)
				.onChange(async (v) => {
					s.previewResolution = v as R2UploaderSettings["previewResolution"];
					customResSetting.settingEl.toggleClass("is-hidden", v !== "custom");
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	customResSetting.addText((t) =>
		t
			.setPlaceholder("1920X1080")
			.setValue(s.previewResolutionCustom)
			.onChange((v) => {
				s.previewResolutionCustom = v.trim();
				ctx.debouncedSave();
				ctx.refreshPreview();
			}),
	);
	customResSetting.settingEl.toggleClass("is-hidden", s.previewResolution !== "custom");

	// ── canvas + states ──────────────────────────────────────────────────────

	const canvasWrap = panel.createDiv({ cls: "r2-preview-canvas-wrap" });
	const canvas = canvasWrap.createEl("canvas", { cls: "r2-preview-canvas" });
	const emptyStateEl = canvasWrap.createDiv({ cls: "r2-preview-empty is-hidden" });
	emptyStateEl.setText("Enable a text or logo watermark to preview it.");

	const logoErrorEl = panel.createDiv({ cls: "r2-preview-logo-error is-hidden" });

	const labelEl = panel.createEl("p", { cls: "r2-preview-label" });

	function renderLogoError(path: string): void {
		logoErrorEl.empty();
		logoErrorEl.removeClass("is-hidden");
		logoErrorEl.createSpan({ text: "Logo file not found: " });
		logoErrorEl.createEl("code", { text: path });
		const btn = logoErrorEl.createEl("button", { text: "Choose another file", cls: "r2-preview-logo-error-btn" });
		btn.addEventListener("click", () => {
			// Switch to the Logo tab (if the tabs component is mounted) then focus its path field.
			activeDocument.querySelector<HTMLElement>('.r2-tab[data-tab-id="logo"]')?.click();
			const input = activeDocument.getElementById(LOGO_PATH_INPUT_ID) as HTMLInputElement | null;
			input?.focus();
			input?.scrollIntoView({ block: "center", behavior: "smooth" });
		});
	}

	function clearLogoError(): void {
		logoErrorEl.empty();
		logoErrorEl.addClass("is-hidden");
	}

	// ── paint ────────────────────────────────────────────────────────────────

	async function paint(): Promise<void> {
		const settings = ctx.plugin.settings;
		const { W, H } = resolveResolution(settings);
		labelEl.setText(`Preview (${W}×${H})`);

		const cctx = canvas.getContext("2d");
		if (!cctx) return;
		canvas.width = W;
		canvas.height = H;
		cctx.setTransform(1, 0, 0, 1, 0, 0);

		drawBackground(cctx, W, H, settings);
		await drawSampleImage(cctx, W, H, settings, ctx);

		const noWatermark = !settings.watermarkEnabled && !settings.watermarkLogoEnabled;
		emptyStateEl.toggleClass("is-hidden", !noWatermark);
		if (noWatermark) {
			clearLogoError();
			return;
		}

		if (settings.watermarkLogoEnabled && settings.watermarkLogoPath) {
			try {
				const logoData = await ctx.app.vault.adapter.readBinary(settings.watermarkLogoPath);
				await paintLogoWatermark(cctx, W, H, settings, logoData);
				clearLogoError();
			} catch {
				renderLogoError(settings.watermarkLogoPath);
			}
		} else {
			clearLogoError();
		}

		paintTextWatermark(cctx, W, H, settings);
	}

	ctx.setPreviewRenderer(paint);
	ctx.refreshPreview();
}
