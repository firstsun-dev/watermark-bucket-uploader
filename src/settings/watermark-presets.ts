import type { R2UploaderSettings, WatermarkPresetId } from "./types";

export type WatermarkPresetValues = Partial<
	Pick<
		R2UploaderSettings,
		| "watermarkEnabled"
		| "watermarkLogoEnabled"
		| "watermarkPosition"
		| "watermarkLogoPosition"
		| "watermarkFontSize"
		| "watermarkColor"
		| "watermarkLogoSize"
		| "watermarkLogoOpacity"
		| "watermarkOffsetX"
		| "watermarkOffsetY"
		| "watermarkLogoOffsetX"
		| "watermarkLogoOffsetY"
	>
>;

export interface WatermarkPresetDef {
	id: WatermarkPresetId;
	label: string;
	description: string;
	values: WatermarkPresetValues;
}

export const WATERMARK_PRESETS: WatermarkPresetDef[] = [
	{
		id: "minimal-corner",
		label: "Minimal corner",
		description: "Small, subtle text in the bottom-right corner.",
		values: {
			watermarkEnabled: true,
			watermarkLogoEnabled: false,
			watermarkPosition: "bottom-right",
			watermarkFontSize: 0,
			watermarkColor: "rgba(255, 255, 255, 0.85)",
			watermarkOffsetX: 0,
			watermarkOffsetY: 0,
		},
	},
	{
		id: "blog-signature",
		label: "Blog signature",
		description: "Larger centered-bottom text, styled like a byline.",
		values: {
			watermarkEnabled: true,
			watermarkLogoEnabled: false,
			watermarkPosition: "bottom-center",
			watermarkFontSize: 28,
			watermarkColor: "rgba(255, 255, 255, 0.9)",
			watermarkOffsetX: 0,
			watermarkOffsetY: -2,
		},
	},
	{
		id: "center-protected",
		label: "Center protected",
		description: "Large, semi-transparent centered text to discourage reuse.",
		values: {
			watermarkEnabled: true,
			watermarkLogoEnabled: false,
			watermarkPosition: "center",
			watermarkFontSize: 48,
			watermarkColor: "rgba(255, 255, 255, 0.35)",
			watermarkOffsetX: 0,
			watermarkOffsetY: 0,
		},
	},
	{
		id: "logo-only",
		label: "Logo only",
		description: "Disables text, enables a small bottom-right logo mark.",
		values: {
			watermarkEnabled: false,
			watermarkLogoEnabled: true,
			watermarkLogoPosition: "bottom-right",
			watermarkLogoSize: 12,
			watermarkLogoOpacity: 0.8,
			watermarkLogoOffsetX: 0,
			watermarkLogoOffsetY: 0,
		},
	},
];

export function findWatermarkPreset(id: WatermarkPresetId): WatermarkPresetDef | undefined {
	return WATERMARK_PRESETS.find((p) => p.id === id);
}
