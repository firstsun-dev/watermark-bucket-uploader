import { Setting } from "obsidian";
import type { SettingsContext } from "../context";
import { makeSection, sectionBody } from "../components/section";

export function renderAdvancedSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const settings = ctx.plugin.settings;
	const details = makeSection(containerEl, "Advanced", false, "settings-2", "advanced");
	const body = sectionBody(details);

	body.createEl("p", {
		cls: "setting-item-description",
		text: "These options are intended for custom S3-compatible services and troubleshooting.",
	});

	// ── Force path-style URLs ───────────────────────────────────────────────

	new Setting(body)
		.setName("Force path-style urls")
		.setDesc("Use path-style requests (bucket.example.com/key) instead of virtual-hosted style. Required by some S3-compatible services.")
		.addToggle((t) =>
			t.setValue(!!settings.forcePathStyle).onChange(async (v) => {
				settings.forcePathStyle = v;
				await ctx.save();
				ctx.rebuildS3Client();
			}),
		);

	// ── Bypass local CORS check ─────────────────────────────────────────────

	new Setting(body)
		.setName("Bypass local cors check")
		.setDesc("Skip the preflight cors check performed before uploads.")
		.addToggle((t) =>
			t.setValue(!!settings.bypassCors).onChange(async (v) => {
				settings.bypassCors = v;
				await ctx.save();
			}),
		);

	// ── Query string key/value ──────────────────────────────────────────────

	new Setting(body)
		.setName("Query string key")
		.setDesc("Optional query string parameter name appended to uploaded object urls.")
		.addText((text) =>
			text
				.setPlaceholder("Key")
				.setValue(settings.queryStringKey)
				.onChange((v) => {
					settings.queryStringKey = v.trim();
					ctx.debouncedSave();
				}),
		);

	new Setting(body)
		.setName("Query string value")
		.setDesc("Optional query string parameter value appended to uploaded object urls.")
		.addText((text) =>
			text
				.setPlaceholder("Value")
				.setValue(settings.queryStringValue)
				.onChange((v) => {
					settings.queryStringValue = v.trim();
					ctx.debouncedSave();
				}),
		);

	// ── Debug mode ───────────────────────────────────────────────────────────

	new Setting(body)
		.setName("Debug mode")
		.setDesc("Print detailed logs to the developer console (Cmd+Opt+I). Disable when not needed.")
		.addToggle((t) =>
			t.setValue(!!settings.debugMode).onChange(async (v) => {
				settings.debugMode = v;
				await ctx.save();
			}),
		);
}
