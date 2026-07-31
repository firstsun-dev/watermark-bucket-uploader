import { Setting } from "obsidian";
import type { SettingsContext } from "../context";
import type { StorageProvider } from "../types";
import { PROVIDER_PRESETS, applyProviderDefaults } from "../provider-presets";

/**
 * Renders the "Storage provider" dropdown — always the first field in the connection
 * section. Selecting a provider applies its region/endpoint-mode defaults (without
 * clobbering credentials/bucket/endpoint the user already typed), rebuilds the S3
 * client, saves immediately, and asks the caller to re-render (so endpoint field
 * visibility/hints stay in sync with the new provider).
 */
export function renderProviderSelect(
	container: HTMLElement,
	ctx: SettingsContext,
	onProviderChanged: () => void,
): Setting {
	const settings = ctx.plugin.settings;

	return new Setting(container)
		.setName("Storage provider")
		.setDesc("Choose your S3-compatible storage provider to prefill sensible defaults.")
		.addDropdown((dropdown) => {
			for (const preset of Object.values(PROVIDER_PRESETS)) {
				dropdown.addOption(preset.id, preset.label);
			}
			dropdown.setValue(settings.storageProvider).onChange(async (value) => {
				const provider = value as StorageProvider;
				applyProviderDefaults(settings, provider);
				ctx.rebuildS3Client();
				await ctx.save();
				onProviderChanged();
			});
		});
}
