import { DropdownComponent, Setting } from "obsidian";
import type { SettingsContext } from "../context";
import type { WatermarkPosition, WatermarkPresetId } from "../types";
import { makeSection, sectionBody } from "../components/section";
import { renderWatermarkTabs, refreshWatermarkTabLabels } from "../components/watermark-tabs";
import { renderPositionPicker } from "../components/position-picker";
import { renderWatermarkPreview } from "../components/watermark-preview";
import { WATERMARK_PRESETS, findWatermarkPreset } from "../watermark-presets";

/** Element id the logo path field renders as, so the preview's logo-error state can focus it. See watermark-preview.ts. */
const LOGO_PATH_INPUT_ID = "r2-watermark-logo-path-input";

// ── Text tab panel ─────────────────────────────────────────────────────────

function renderTextPanel(
	panel: HTMLElement,
	ctx: SettingsContext,
	controlsRoot: HTMLElement,
	markPresetCustom: () => void,
): void {
	const s = ctx.plugin.settings;
	const fields: Setting[] = [];
	let positionPickerWrap: HTMLElement | null = null;

	function toggleFields(show: boolean): void {
		fields.forEach((f) => f.settingEl.toggleClass("is-hidden", !show));
		positionPickerWrap?.toggleClass("is-hidden", !show);
	}

	new Setting(panel)
		.setName("Enable text watermark")
		.addToggle((t) =>
			t.setValue(s.watermarkEnabled).onChange(async (v) => {
				s.watermarkEnabled = v;
				markPresetCustom();
				toggleFields(v);
				refreshWatermarkTabLabels(controlsRoot, ctx);
				await ctx.save();
				ctx.refreshPreview();
			}),
		);

	// ── Content ──────────────────────────────────────────────────────────────
	new Setting(panel).setName("Content").setHeading();

	fields.push(
		new Setting(panel).setName("Text").addText((text) =>
			text
				.setPlaceholder("© firstsun.org")
				.setValue(s.watermarkText)
				.onChange((v) => {
					s.watermarkText = v;
					ctx.debouncedSave();
					ctx.refreshPreview();
				}),
		),
	);

	// ── Typography ───────────────────────────────────────────────────────────
	new Setting(panel).setName("Typography").setHeading();

	fields.push(
		new Setting(panel)
			.setName("Font family")
			.setDesc('E.g. "arial", "georgia", "monospace"')
			.addText((text) =>
				text
					.setPlaceholder("Arial")
					.setValue(s.watermarkFontFamily)
					.onChange((v) => {
						s.watermarkFontFamily = v || "Arial";
						ctx.debouncedSave();
						ctx.refreshPreview();
					}),
			),
	);

	fields.push(
		new Setting(panel)
			.setName("Font size (px)")
			.setDesc("0 = auto (2% of image width)")
			.addSlider((sl) =>
				sl
					.setDynamicTooltip()
					.setLimits(0, 120, 2)
					.setValue(s.watermarkFontSize)
					.onChange(async (v) => {
						s.watermarkFontSize = v;
						markPresetCustom();
						await ctx.save();
						ctx.refreshPreview();
					}),
			),
	);

	fields.push(
		new Setting(panel)
			.setName("Style")
			.addToggle((t) =>
				t.setValue(s.watermarkBold).onChange(async (v) => {
					s.watermarkBold = v;
					await ctx.save();
					ctx.refreshPreview();
				}),
			)
			.addExtraButton((b) => b.setTooltip("Bold").setIcon("bold"))
			.addToggle((t) =>
				t.setValue(s.watermarkItalic).onChange(async (v) => {
					s.watermarkItalic = v;
					await ctx.save();
					ctx.refreshPreview();
				}),
			)
			.addExtraButton((b) => b.setTooltip("Italic").setIcon("italic")),
	);

	fields.push(
		new Setting(panel)
			.setName("Color")
			.setDesc('CSS color, e.g. "rgba(255,255,255,0.85)" or "#ffffff"')
			.addText((text) =>
				text
					.setPlaceholder("Rgba(255,255,255,0.85)")
					.setValue(s.watermarkColor)
					.onChange((v) => {
						s.watermarkColor = v;
						markPresetCustom();
						ctx.debouncedSave();
						ctx.refreshPreview();
					}),
			),
	);

	// ── Placement ────────────────────────────────────────────────────────────
	new Setting(panel).setName("Placement").setHeading();

	positionPickerWrap = panel.createDiv({ cls: "r2-watermark-placement" });
	renderPositionPicker(positionPickerWrap, "Text position", s.watermarkPosition, (pos: WatermarkPosition) => {
		s.watermarkPosition = pos;
		markPresetCustom();
		void ctx.save();
		ctx.refreshPreview();
	});

	const fineTune = positionPickerWrap.createEl("details", { cls: "r2-fine-tune" });
	fineTune.createEl("summary", { text: "Fine tune position" });

	new Setting(fineTune)
		.setName("Offset X")
		.setDesc("Horizontal nudge (% of image width, negative = left)")
		.addSlider((sl) =>
			sl
				.setDynamicTooltip()
				.setLimits(-30, 30, 1)
				.setValue(s.watermarkOffsetX)
				.onChange(async (v) => {
					s.watermarkOffsetX = v;
					markPresetCustom();
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	new Setting(fineTune)
		.setName("Offset y")
		.setDesc("Vertical nudge (% of image height, negative = up)")
		.addSlider((sl) =>
			sl
				.setDynamicTooltip()
				.setLimits(-30, 30, 1)
				.setValue(s.watermarkOffsetY)
				.onChange(async (v) => {
					s.watermarkOffsetY = v;
					markPresetCustom();
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	toggleFields(s.watermarkEnabled);
}

// ── Logo tab panel ─────────────────────────────────────────────────────────

function renderLogoPanel(
	panel: HTMLElement,
	ctx: SettingsContext,
	controlsRoot: HTMLElement,
	markPresetCustom: () => void,
): void {
	const s = ctx.plugin.settings;
	const fields: Setting[] = [];
	let positionPickerWrap: HTMLElement | null = null;

	function toggleFields(show: boolean): void {
		fields.forEach((f) => f.settingEl.toggleClass("is-hidden", !show));
		positionPickerWrap?.toggleClass("is-hidden", !show);
	}

	new Setting(panel)
		.setName("Enable logo watermark")
		.addToggle((t) =>
			t.setValue(s.watermarkLogoEnabled).onChange(async (v) => {
				s.watermarkLogoEnabled = v;
				markPresetCustom();
				toggleFields(v);
				refreshWatermarkTabLabels(controlsRoot, ctx);
				await ctx.save();
				ctx.refreshPreview();
			}),
		);

	// ── Source ───────────────────────────────────────────────────────────────
	new Setting(panel).setName("Source").setHeading();

	const pathSetting = new Setting(panel)
		.setName("Logo path (vault-relative)")
		.setDesc('e.g. "_assets/logo-wm.png"')
		.addText((text) => {
			text.inputEl.id = LOGO_PATH_INPUT_ID;
			text
				.setPlaceholder("_assets/logo-wm.png")
				.setValue(s.watermarkLogoPath)
				.onChange((v) => {
					const trimmed = v.trim();
					s.watermarkLogoPath = trimmed;
					ctx.debouncedSave();
					ctx.refreshPreview();
					void updateLogoPathValidation(trimmed);
				});
		});
	fields.push(pathSetting);

	async function updateLogoPathValidation(path: string): Promise<void> {
		const descEl = pathSetting.descEl;
		if (!path) {
			descEl.setText('e.g. "_assets/logo-wm.png"');
			descEl.removeClass("r2-success", "r2-error");
			return;
		}
		const exists = await ctx.app.vault.adapter.exists(path);
		descEl.setText(exists ? "✓ File found" : "⚠ File not found in vault");
		descEl.toggleClass("r2-success", exists);
		descEl.toggleClass("r2-error", !exists);
	}
	void updateLogoPathValidation(s.watermarkLogoPath);

	// ── Appearance ───────────────────────────────────────────────────────────
	new Setting(panel).setName("Appearance").setHeading();

	fields.push(
		new Setting(panel)
			.setName("Logo size (% of image width)")
			.addSlider((sl) =>
				sl
					.setDynamicTooltip()
					.setLimits(1, 50, 1)
					.setValue(s.watermarkLogoSize)
					.onChange(async (v) => {
						s.watermarkLogoSize = v;
						markPresetCustom();
						await ctx.save();
						ctx.refreshPreview();
					}),
			),
	);

	fields.push(
		new Setting(panel)
			.setName("Logo opacity")
			.addSlider((sl) =>
				sl
					.setDynamicTooltip()
					.setLimits(0.0, 1.0, 0.05)
					.setValue(s.watermarkLogoOpacity)
					.onChange(async (v) => {
						s.watermarkLogoOpacity = v;
						markPresetCustom();
						await ctx.save();
						ctx.refreshPreview();
					}),
			),
	);

	// ── Placement ────────────────────────────────────────────────────────────
	new Setting(panel).setName("Placement").setHeading();

	positionPickerWrap = panel.createDiv({ cls: "r2-watermark-placement" });
	renderPositionPicker(positionPickerWrap, "Logo position", s.watermarkLogoPosition, (pos: WatermarkPosition) => {
		s.watermarkLogoPosition = pos;
		markPresetCustom();
		void ctx.save();
		ctx.refreshPreview();
	});

	const fineTune = positionPickerWrap.createEl("details", { cls: "r2-fine-tune" });
	fineTune.createEl("summary", { text: "Fine tune position" });

	new Setting(fineTune)
		.setName("Offset X")
		.setDesc("Horizontal nudge (% of image width)")
		.addSlider((sl) =>
			sl
				.setDynamicTooltip()
				.setLimits(-30, 30, 1)
				.setValue(s.watermarkLogoOffsetX)
				.onChange(async (v) => {
					s.watermarkLogoOffsetX = v;
					markPresetCustom();
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	new Setting(fineTune)
		.setName("Offset y")
		.setDesc("Vertical nudge (% of image height)")
		.addSlider((sl) =>
			sl
				.setDynamicTooltip()
				.setLimits(-30, 30, 1)
				.setValue(s.watermarkLogoOffsetY)
				.onChange(async (v) => {
					s.watermarkLogoOffsetY = v;
					markPresetCustom();
					await ctx.save();
					ctx.refreshPreview();
				}),
		);

	toggleFields(s.watermarkLogoEnabled);
}

// ── Preset picker ────────────────────────────────────────────────────────────

/**
 * Renders the preset dropdown. Selecting a preset applies it immediately (no native
 * confirm dialog) and shows the preset's description; selecting "Custom" just records
 * the choice. Returns the dropdown so callers can sync it back to "Custom" when the user
 * edits any preset-controlled field (see markPresetCustom in renderWatermarkSection).
 */
function renderPresetPicker(
	container: HTMLElement,
	ctx: SettingsContext,
	onApplied: () => void,
): DropdownComponent {
	const s = ctx.plugin.settings;
	let dropdown!: DropdownComponent;

	const setting = new Setting(container)
		.setName("Preset")
		.setDesc("Apply a ready-made watermark style, or keep tweaking your own (custom).")
		.addDropdown((d) => {
			dropdown = d;
			for (const preset of WATERMARK_PRESETS) d.addOption(preset.id, preset.label);
			d.addOption("custom", "Custom");
			d.setValue(s.watermarkPreset);
			d.onChange(async (v) => {
				const id = v as WatermarkPresetId;
				if (id === "custom") {
					s.watermarkPreset = id;
					await ctx.save();
					return;
				}
				const preset = findWatermarkPreset(id);
				if (!preset) return;
				Object.assign(s, preset.values);
				s.watermarkPreset = preset.id;
				await ctx.save();
				ctx.refreshPreview();
				onApplied();
			});
		});

	// Inline description of the currently-selected preset, kept in sync after apply/refresh.
	const noteEl = setting.descEl.createDiv({ cls: "r2-field-hint" });
	const updateNote = () => {
		const current = s.watermarkPreset === "custom" ? undefined : findWatermarkPreset(s.watermarkPreset);
		noteEl.setText(current ? current.description : "Your own combination of text and logo settings.");
	};
	updateNote();

	return dropdown;
}

// ── Section entry point ─────────────────────────────────────────────────────

/**
 * Renders the Watermark section: preset picker, then a mobile-first layout where the
 * preview panel (`r2-preview-panel`) is emitted before the controls column
 * (`r2-watermark-controls`) in DOM order, wrapped together in `r2-watermark-layout`.
 * On desktop, the CSS grid for `r2-watermark-layout` should place `r2-watermark-controls`
 * in the left column and `r2-preview-panel` in the right column (e.g. via explicit
 * `grid-column` / `grid-template-areas`) despite the preview panel coming first in markup.
 */
export function renderWatermarkSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const s = ctx.plugin.settings;
	const connectionConfigured = !!s.accessKey && !!s.secretKey && !!s.bucket;
	const details = makeSection(containerEl, "Watermark", connectionConfigured, "stamp", "watermark");
	const body = sectionBody(details);

	const bodyContainer = body.createDiv({ cls: "r2-watermark-section-body" });

	// Tracks the current preset dropdown so markPresetCustom can sync it back to "Custom"
	// whenever the user edits a preset-controlled field.
	let presetDropdown: DropdownComponent | null = null;
	const markPresetCustom = () => {
		if (s.watermarkPreset === "custom") return;
		s.watermarkPreset = "custom";
		presetDropdown?.setValue("custom");
		void ctx.save();
	};

	function build(): void {
		bodyContainer.empty();

		presetDropdown = renderPresetPicker(bodyContainer, ctx, () => build());

		const layout = bodyContainer.createDiv({ cls: "r2-watermark-layout" });

		// Preview panel (`renderWatermarkPreview` gives its root element the
		// `r2-preview-panel` class) is emitted FIRST in DOM order (mobile-first) and must
		// be a DIRECT child of `.r2-watermark-layout` — the grid CSS places it via
		// `grid-column: 2` regardless of DOM order, so it visually ends up on the right
		// on desktop while still being first for narrow-screen linear layout.
		renderWatermarkPreview(layout, ctx);

		const controls = layout.createDiv({ cls: "r2-watermark-controls" });
		renderWatermarkTabs(
			controls,
			ctx,
			(panel) => renderTextPanel(panel, ctx, controls, markPresetCustom),
			(panel) => renderLogoPanel(panel, ctx, controls, markPresetCustom),
		);
	}

	build();
}
