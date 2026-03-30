// Based on jvsteiner/s3-image-uploader (MIT License)
// Extended with WebP conversion, watermark with live preview, and collapsible settings UI.

import { Editor, MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { S3Client } from "@aws-sdk/client-s3";
import { minimatch } from "minimatch";
import { R2UploaderSettings, DEFAULT_SETTINGS, R2UploaderSettingTab, pasteFunction } from "./settings";
import { createS3Client } from "./uploader";
import { pasteHandler } from "./pasteHandler";

export default class R2UploaderPlugin extends Plugin {
	settings: R2UploaderSettings;
	s3: S3Client;
	pasteFunction: pasteFunction;

	log(...args: unknown[]): void {
		if (this.settings.debugMode) {
			console.log("[R2Uploader]", ...args);
		}
	}

	shouldIgnoreCurrentFile(): boolean {
		const noteFile = this.app.workspace.getActiveFile();
		if (!noteFile || !this.settings.ignorePattern) return false;
		return matchesGlobPattern(noteFile.path, this.settings.ignorePattern);
	}

	createS3Client(): void {
		if (!this.settings.region) return;
		const apiEndpoint = this.settings.useCustomEndpoint
			? this.settings.customEndpoint
			: `https://s3.${this.settings.region}.amazonaws.com/`;
		this.settings.imageUrlPath = this.settings.useCustomImageUrl
			? this.settings.customImageUrl
			: this.settings.forcePathStyle
				? apiEndpoint + this.settings.bucket + "/"
				: apiEndpoint.replace("://", `://${this.settings.bucket}.`);
		this.s3 = createS3Client(this.settings);
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new R2UploaderSettingTab(this.app, this));
		this.createS3Client();

		this.addCommand({
			id: "upload-image",
			name: "Upload image",
			icon: "image-plus",
			mobileOnly: false,
			editorCallback: (editor) => {
				const input = document.createElement("input");
				input.type = "file";
				input.oninput = (event) => {
					if (event.target) this.runPasteHandler(event, editor);
				};
				input.click();
				input.remove();
			},
		});

		this.pasteFunction = (event, editor) => this.runPasteHandler(event, editor);
		this.registerEvent(this.app.workspace.on("editor-paste", this.pasteFunction));
		this.registerEvent(this.app.workspace.on("editor-drop", this.pasteFunction));

		this.registerEvent(this.app.vault.on("create", async (file) => {
			if (this.settings.disableAutoUploadOnCreate) return;
			if (!(file instanceof TFile)) return;
			if (!file.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;
			if (this.shouldIgnoreCurrentFile()) return;
			try {
				const fileContent = await this.app.vault.readBinary(file);
				const newFile = new File([fileContent], file.name, { type: `image/${file.extension}` });
				await this.runPasteHandler(null, activeView.editor, newFile);
				await new Promise((resolve) => setTimeout(resolve, 50));
				const content = activeView.editor.getValue();
				const obsidianLink = (this.app.vault as any).getConfig("useMarkdownLinks")
					? `![](${file.name.split(" ").join("%20")})`
					: `![[${file.name}]]`;
				const position = content.indexOf(obsidianLink);
				if (position !== -1) {
					const from = activeView.editor.offsetToPos(position);
					const to = activeView.editor.offsetToPos(position + obsidianLink.length);
					activeView.editor.replaceRange("", from, to);
				} else {
					new Notice(`Failed to find: ${obsidianLink}`);
				}
				await this.app.vault.delete(file);
			} catch (error) {
				new Notice(`Error processing file: ${error.message}`);
			}
		}));
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private runPasteHandler(
		ev: ClipboardEvent | DragEvent | Event | null,
		editor: Editor,
		directFile?: File,
	): Promise<void> {
		const adapter = this.app.vault.adapter;
		const getFilePath = "getFilePath" in adapter
			? (path: string) => (adapter as any).getFilePath(path)
			: null;
		return pasteHandler(
			ev,
			editor,
			this.settings,
			this.s3,
			(path) => adapter.readBinary(path),
			(path, data) => adapter.writeBinary(path, data),
			getFilePath,
			() => {
				const f = this.app.workspace.getActiveFile();
				if (!f) return null;
				return { name: f.name, basename: f.basename, path: f.path };
			},
			(file) => {
				const tfile = this.app.vault.getAbstractFileByPath(file.path);
				if (!(tfile instanceof TFile)) return undefined;
				return this.app.metadataCache.getFileCache(tfile)?.frontmatter;
			},
			() => this.shouldIgnoreCurrentFile(),
			(...args) => this.log(...args),
			directFile,
		);
	}
}

function matchesGlobPattern(filePath: string, pattern: string): boolean {
	if (!pattern?.trim()) return false;
	return pattern.split(",").map((p) => p.trim()).some((p) => minimatch(filePath, p));
}
