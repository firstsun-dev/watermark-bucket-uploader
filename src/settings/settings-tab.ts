import { App, PluginSettingTab, TextComponent, setIcon } from "obsidian";
import type R2UploaderPlugin from "../main";
import type { SettingsContext } from "./context";
import { debounce } from "./utils";
import { renderConnectionSection } from "./sections/connection-section";
import { renderUploadSection } from "./sections/upload-section";
import { renderProcessingSection } from "./sections/processing-section";
import { renderWatermarkSection } from "./sections/watermark-section";
import { renderAdvancedSection } from "./sections/advanced-section";
import { renderSetupStatus } from "./components/status-card";

const TEXT_SAVE_DEBOUNCE_MS = 400;
const PREVIEW_RENDER_DEBOUNCE_MS = 150;

export const wrapTextWithPasswordHide = (text: TextComponent) => {
	const hider = text.inputEl.insertAdjacentElement("beforebegin", createSpan());
	if (!hider) return;
	setIcon(hider as HTMLElement, "eye-off");
	(hider as HTMLElement).setAttribute("role", "button");
	(hider as HTMLElement).setAttribute("tabindex", "0");
	(hider as HTMLElement).setAttribute("aria-label", "Show password");
	const toggle = () => {
		const isText = text.inputEl.getAttribute("type") === "text";
		setIcon(hider as HTMLElement, isText ? "eye-off" : "eye");
		text.inputEl.setAttribute("type", isText ? "password" : "text");
		(hider as HTMLElement).setAttribute("aria-label", isText ? "Show password" : "Hide password");
		text.inputEl.focus();
	};
	hider.addEventListener("click", toggle);
	hider.addEventListener("keydown", (e) => {
		if (e instanceof KeyboardEvent && (e.key === "Enter" || e.key === " ")) {
			e.preventDefault();
			toggle();
		}
	});
	text.inputEl.setAttribute("type", "password");
	return text;
};

export class R2UploaderSettingTab extends PluginSettingTab {
	plugin: R2UploaderPlugin;
	private previewRenderer: (() => void | Promise<void>) | null = null;
	private statusRenderer: (() => void) | null = null;
	private readonly debouncedSaveImpl = debounce(() => { void this.plugin.saveSettings(); }, TEXT_SAVE_DEBOUNCE_MS);
	private readonly debouncedPreviewImpl = debounce(() => {
		if (!this.previewRenderer) return;
		void this.previewRenderer();
	}, PREVIEW_RENDER_DEBOUNCE_MS);

	constructor(app: App, plugin: R2UploaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private buildContext(): SettingsContext {
		return {
			app: this.app,
			plugin: this.plugin,
			save: async () => {
				await this.plugin.saveSettings();
				this.statusRenderer?.();
			},
			debouncedSave: () => {
				this.debouncedSaveImpl();
				this.statusRenderer?.();
			},
			refreshPreview: () => this.debouncedPreviewImpl(),
			setPreviewRenderer: (fn) => { this.previewRenderer = fn; },
			refreshSetupStatus: () => this.statusRenderer?.(),
			setStatusRenderer: (fn) => { this.statusRenderer = fn; },
			markConnectionDirty: () => {
				this.plugin.settings.connectionNeedsRetest = true;
				void this.plugin.saveSettings();
				this.statusRenderer?.();
			},
			rebuildS3Client: () => this.plugin.createS3Client(),
		};
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("r2-settings");
		this.previewRenderer = null;
		this.statusRenderer = null;

		const ctx = this.buildContext();

		renderSetupStatus(containerEl, ctx);
		renderConnectionSection(containerEl, ctx);
		renderUploadSection(containerEl, ctx);
		renderProcessingSection(containerEl, ctx);
		renderWatermarkSection(containerEl, ctx);
		renderAdvancedSection(containerEl, ctx);

		ctx.refreshSetupStatus();
		ctx.refreshPreview();
	}

	hide(): void {
		this.previewRenderer = null;
		this.statusRenderer = null;
	}
}
