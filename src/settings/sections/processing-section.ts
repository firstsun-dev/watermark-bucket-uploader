import { Setting } from "obsidian";
import type { SettingsContext } from "../context";
import { makeSection, sectionBody } from "../components/section";

/** Renders the pipeline order indicator: a purely informational, non-interactive list. */
function renderPipelineIndicator(container: HTMLElement): void {
	const steps = ["Resize", "Compress", "Convert format", "Apply watermark", "Upload"];
	const list = container.createEl("ol", { cls: "r2-pipeline-indicator" });
	list.setAttribute("aria-hidden", "false");
	for (const step of steps) {
		list.createEl("li", { text: step });
	}
}

/** Maps a webpQuality value (0.1-1.0) to a short semantic label describing the tradeoff. */
function webpQualityLabel(quality: number): string {
	const pct = Math.round(quality * 100);
	if (pct < 70) return "Smaller file";
	if (pct <= 85) return "Balanced · Moderate file size";
	return "Higher quality · Larger file";
}

export function renderProcessingSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const settings = ctx.plugin.settings;
	const details = makeSection(containerEl, "Image processing", false, "image", "processing");
	const body = sectionBody(details);

	renderPipelineIndicator(body);

	// ── Convert to WebP ──────────────────────────────────────────────────────

	new Setting(body)
		.setName("Convert images to webp")
		.setDesc("Convert images to webp before uploading. Filename becomes .webp.")
		.addToggle((t) =>
			t.setValue(settings.convertToWebP).onChange(async (v) => {
				settings.convertToWebP = v;
				webpQualitySetting.settingEl.toggleClass("is-hidden", !v);
				await ctx.save();
			}),
		);

	const webpQualitySetting = new Setting(body)
		.setName("Webp quality")
		.setDesc("0.1 (smaller file) — 1.0 (best quality). Default: 0.85")
		.addSlider((s) =>
			s
				.setDynamicTooltip()
				.setLimits(0.1, 1.0, 0.05)
				.setValue(settings.webpQuality)
				.onChange(async (v) => {
					settings.webpQuality = v;
					updateWebpEstimate(v);
					await ctx.save();
				}),
		);

	const webpEstimateEl = webpQualitySetting.descEl.createDiv({ cls: "r2-field-hint" });

	function updateWebpEstimate(quality: number): void {
		webpEstimateEl.setText(`Estimated result: ${webpQualityLabel(quality)}`);
	}

	webpQualitySetting.settingEl.toggleClass("is-hidden", !settings.convertToWebP);
	updateWebpEstimate(settings.webpQuality);

	// ── Compression ──────────────────────────────────────────────────────────

	new Setting(body).setName("Compression").setHeading();

	const compressionSettings: Setting[] = [];

	function toggleCompressionSettings(show: boolean): void {
		compressionSettings.forEach((s) => s.settingEl.toggleClass("is-hidden", !show));
	}

	new Setting(body)
		.setName("Enable compression")
		.setDesc("Compress images before uploading, in addition to any webp conversion.")
		.addToggle((t) =>
			t.setValue(settings.enableImageCompression).onChange(async (v) => {
				settings.enableImageCompression = v;
				toggleCompressionSettings(v);
				await ctx.save();
			}),
		);

	compressionSettings.push(
		new Setting(body)
			.setName("Target max size")
			.setDesc("Maximum file size in mb. Default: 1")
			.addText((text) =>
				text
					.setPlaceholder("1")
					.setValue(settings.maxImageCompressionSize.toString())
					.onChange((v) => {
						const n = parseFloat(v);
						if (!isNaN(n) && n > 0) {
							settings.maxImageCompressionSize = n;
							ctx.debouncedSave();
						}
					}),
			),
	);

	compressionSettings.push(
		new Setting(body)
			.setName("Max width or height")
			.setDesc("Maximum width or height in px. Default: 4096")
			.addText((text) =>
				text
					.setPlaceholder("4096")
					.setValue(settings.maxImageWidthOrHeight.toString())
					.onChange((v) => {
						const n = parseInt(v, 10);
						if (!isNaN(n) && n > 0) {
							settings.maxImageWidthOrHeight = n;
							ctx.debouncedSave();
						}
					}),
			),
	);

	compressionSettings.push(
		new Setting(body)
			.setName("Compression quality")
			.setDesc("0% (smaller file) — 100% (best quality). Default: 70%")
			.addSlider((s) =>
				s
					.setDynamicTooltip()
					.setLimits(0.0, 1.0, 0.05)
					.setValue(settings.imageCompressionQuality)
					.onChange(async (v) => {
						settings.imageCompressionQuality = v;
						await ctx.save();
					}),
			),
	);

	toggleCompressionSettings(settings.enableImageCompression);
}
