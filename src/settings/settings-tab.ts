import { App, PluginSettingTab, TextComponent, setIcon } from "obsidian";
import type R2UploaderPlugin from "../main";
import type { SettingsContext } from "./context";
import type { R2UploaderSettings } from "./types";
import { debounce } from "./utils";
import { renderConnectionSection } from "./sections/connection-section";
import { renderUploadSection } from "./sections/upload-section";
import { renderProcessingSection } from "./sections/processing-section";
import { renderWatermarkSection } from "./sections/watermark-section";
import { renderAdvancedSection } from "./sections/advanced-section";
import { renderSetupStatus } from "./components/status-card";

const TEXT_SAVE_DEBOUNCE_MS = 400;
const PREVIEW_RENDER_DEBOUNCE_MS = 150;

type SectionId = "connection" | "upload" | "processing" | "watermark" | "advanced";

/** Picks the section to open by default based on the user's setup progress. */
function pickDefaultOpenSection(s: R2UploaderSettings): SectionId {
	if (s.localUpload) return "upload";
	const storageIncomplete = !s.accessKey || !s.secretKey || !s.bucket;
	if (storageIncomplete) return "connection";
	const needsTest = s.connectionNeedsRetest || s.lastConnectionTestSuccess !== true;
	return needsTest ? "connection" : "upload";
}

/** Opens one section, closing the others (accordion behavior). */
function openSectionExclusive(containerEl: HTMLElement, id: SectionId): void {
	const sections = Array.from(containerEl.querySelectorAll<HTMLDetailsElement>("[data-r2-section]"));
	for (const el of sections) {
		const isTarget = el.getAttribute("data-r2-section") === id;
		el.toggleAttribute("open", isTarget);
	}
}

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
				this.statusRenderer?.();
			},
			rebuildS3Client: () => this.plugin.createS3Client(),
			refreshImageUrlPath: () => this.plugin.updateImageUrlPath(),
			focusFirstOpenSection: () => {
				const s = this.plugin.settings;
				const target: SectionId = s.localUpload ? "upload" : "connection";
				openSectionExclusive(this.containerEl, target);
				const el = this.containerEl.querySelector<HTMLElement>(`[data-r2-section="${target}"]`);
				el?.scrollIntoView({ block: "start", behavior: "smooth" });
			},
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

		// Accordion: opening one section closes the others; open a state-driven default.
		const sections = Array.from(containerEl.querySelectorAll<HTMLDetailsElement>("[data-r2-section]"));
		for (const el of sections) {
			el.addEventListener("toggle", () => {
				if (!el.open) return;
				for (const other of sections) {
					if (other !== el && other.open) other.open = false;
				}
			});
		}
		openSectionExclusive(containerEl, pickDefaultOpenSection(this.plugin.settings));

		ctx.refreshSetupStatus();
		ctx.refreshPreview();
	}

	hide(): void {
		this.previewRenderer = null;
		this.statusRenderer = null;
	}
}
