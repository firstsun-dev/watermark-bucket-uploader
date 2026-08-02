import { Setting } from "obsidian";
import type { SettingsContext } from "../context";
import { makeSection, sectionBody } from "../components/section";
import { setFieldMessage, markRequired } from "../components/field-message";
import { validateHttpsUrl, normalizeUrl } from "../validation";
import { PROVIDER_PRESETS } from "../provider-presets";
import { renderProviderSelect } from "../components/provider-select";
import { renderConnectionTest } from "../components/connection-test";
import { wrapTextWithPasswordHide } from "../settings-tab";

/**
 * Renders the "Storage connection" section: provider picker, credentials, bucket/region,
 * endpoint (provider-dependent), public image URL override, bucket folder template, and
 * the connection test status block.
 */
export function renderConnectionSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const settings = ctx.plugin.settings;
	const notConfigured = !settings.accessKey || !settings.secretKey || !settings.bucket;

	const details = makeSection(containerEl, "Storage connection", notConfigured, "key");
	const body = sectionBody(details);

	const renderBody = () => {
		body.empty();

		// Storage provider — re-renders this body on change so endpoint visibility/hints update.
		renderProviderSelect(body, ctx, renderBody);

		const preset = PROVIDER_PRESETS[settings.storageProvider];

		// Credential/bucket/region/endpoint changes: persist the value on each keystroke (debounced),
		// but only mark the connection stale + rebuild the S3 client on blur — avoids rebuilding the
		// client and flipping the connection status on every character typed.
		const onCredentialChange = () => {
			ctx.markConnectionDirty();
			ctx.debouncedSave();
		};
		const onCredentialBlur = () => {
			ctx.rebuildS3Client();
			void ctx.save();
		};

		// Access key ID
		const accessKeySetting = new Setting(body)
			.setName("Access key ID")
			.addText((text) => {
				wrapTextWithPasswordHide(text);
				text.setPlaceholder("Access key")
					.setValue(settings.accessKey)
					.onChange((v) => {
						settings.accessKey = v.trim();
						onCredentialChange();
					});
				text.inputEl.addEventListener("blur", onCredentialBlur);
			});
		markRequired(accessKeySetting);

		// Secret access key
		const secretKeySetting = new Setting(body)
			.setName("Secret access key")
			.addText((text) => {
				wrapTextWithPasswordHide(text);
				text.setPlaceholder("Secret key")
					.setValue(settings.secretKey)
					.onChange((v) => {
						settings.secretKey = v.trim();
						onCredentialChange();
					});
				text.inputEl.addEventListener("blur", onCredentialBlur);
			});
		markRequired(secretKeySetting);

		// Bucket name
		const bucketSetting = new Setting(body)
			.setName("Bucket name")
			.addText((text) => {
				text.setPlaceholder("Bucket name")
					.setValue(settings.bucket)
					.onChange((v) => {
						settings.bucket = v.trim();
						onCredentialChange();
					});
				text.inputEl.addEventListener("blur", onCredentialBlur);
			});
		markRequired(bucketSetting);

		// Region
		const regionSetting = new Setting(body)
			.setName("Region")
			.setDesc('"auto" for cloudflare r2.')
			.addText((text) => {
				text.setPlaceholder("Auto")
					.setValue(settings.region)
					.onChange((v) => {
						settings.region = v.trim();
						onCredentialChange();
					});
				text.inputEl.addEventListener("blur", onCredentialBlur);
			});
		if (!settings.useCustomEndpoint) markRequired(regionSetting);

		// Endpoint URL — shown/required only for providers that use a custom endpoint.
		const endpointSetting = new Setting(body)
			.setName("Endpoint URL")
			.setDesc(preset.endpointHint)
			.addText((text) => {
				text.setPlaceholder(preset.endpointPlaceholder)
					.setValue(settings.customEndpoint)
					.onChange((v) => {
						const result = validateHttpsUrl(v, { required: settings.useCustomEndpoint });
						setFieldMessage(endpointSetting, result.valid ? null : result.message ?? null, "error");
					});
				text.inputEl.addEventListener("blur", () => {
					const raw = text.inputEl.value;
					if (!raw.trim()) {
						settings.customEndpoint = "";
					} else {
						const normalized = normalizeUrl(raw);
						settings.customEndpoint = normalized;
						text.setValue(normalized);
					}
					const result = validateHttpsUrl(settings.customEndpoint, { required: settings.useCustomEndpoint });
					setFieldMessage(endpointSetting, result.valid ? null : result.message ?? null, "error");
					onCredentialChange();
					onCredentialBlur();
				});
			});
		endpointSetting.settingEl.toggleClass("is-hidden", !settings.useCustomEndpoint);
		if (settings.useCustomEndpoint) markRequired(endpointSetting);

		// Public image URL — optional override of the public URL base (CDN / custom domain).
		// Leaving it blank falls back to the provider/bucket default. Changing it does NOT affect
		// the bucket connection, so it never marks the connection stale or rebuilds the S3 client;
		// it only refreshes the derived URL base.
		const imageUrlSetting = new Setting(body)
			.setName("Public image URL")
			.setDesc("Override the public URL base used for uploaded file links. Leave blank to use the default.")
			.addText((text) => {
				text.setPlaceholder("HTTPS://cdn.example.com/")
					.setValue(settings.customImageUrl)
					.onChange((v) => {
						const result = validateHttpsUrl(v, { required: false });
						setFieldMessage(imageUrlSetting, result.valid ? null : result.message ?? null, "error");
					});
				text.inputEl.addEventListener("blur", () => {
					const raw = text.inputEl.value;
					if (!raw.trim()) {
						settings.customImageUrl = "";
						settings.useCustomImageUrl = false;
					} else {
						const normalized = normalizeUrl(raw);
						settings.customImageUrl = normalized;
						settings.useCustomImageUrl = true;
						text.setValue(normalized);
					}
					const result = validateHttpsUrl(settings.customImageUrl, { required: false });
					setFieldMessage(imageUrlSetting, result.valid ? null : result.message ?? null, "error");
					ctx.refreshImageUrlPath();
					void ctx.save();
				});
			});

		// Bucket folder — path template, doesn't affect the S3 client itself.
		new Setting(body)
			.setName("Bucket folder")
			.setDesc("Supports ${year}, ${month}, ${day}, ${basename}.")
			.addText((text) => {
				text.setPlaceholder("blog/${basename}")
					.setValue(settings.folder)
					.onChange((v) => {
						settings.folder = v.trim();
						ctx.debouncedSave();
					});
			});

		// Connection test status block.
		renderConnectionTest(body, ctx);
	};

	renderBody();
}
