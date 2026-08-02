import { AbstractInputSuggest, Setting, TFolder } from "obsidian";
import type { SettingsContext } from "../context";
import { makeSection, sectionBody } from "../components/section";

let checkboxIdCounter = 0;

/** Suggests vault folders for a text input, used for the local-upload destination folder. */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(private ctx: SettingsContext, textInputEl: HTMLInputElement) {
		super(ctx.app, textInputEl);
	}

	protected getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		return this.ctx.app.vault
			.getAllFolders(true)
			.filter((folder) => folder.path.toLowerCase().includes(q));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || "/");
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.ctx.plugin.settings.localUploadFolder = folder.path;
		this.ctx.debouncedSave();
		this.close();
	}
}

/** Adds a single toggle row (immediate save) for a boolean settings field. */
function addToggle(
	container: HTMLElement,
	name: string,
	desc: string,
	getSet: [() => boolean, (v: boolean) => void],
	ctx: SettingsContext,
): void {
	const [get, set] = getSet;
	new Setting(container)
		.setName(name)
		.setDesc(desc)
		.addToggle((toggle) =>
			toggle.setValue(get()).onChange(async (v) => {
				set(v);
				await ctx.save();
			}),
		);
}

/** A single checkbox row with a real <input type=checkbox> + associated <label>, for accessible checkbox semantics. */
function addCheckboxRow(
	container: HTMLElement,
	label: string,
	desc: string,
	opts: { checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void },
): void {
	const id = `r2-upload-filetype-${checkboxIdCounter++}`;
	const row = container.createDiv({ cls: "r2-checkbox-row" });

	const input = row.createEl("input", { type: "checkbox", attr: { id } });
	input.checked = opts.checked;
	if (opts.disabled) input.disabled = true;
	if (opts.onChange) {
		input.addEventListener("change", () => opts.onChange?.(input.checked));
	}

	const labelWrap = row.createDiv({ cls: "r2-checkbox-label-wrap" });
	const labelEl = labelWrap.createEl("label", { text: label, attr: { for: id } });
	labelEl.addClass("r2-checkbox-label");
	if (desc) {
		labelWrap.createDiv({ cls: "r2-checkbox-desc", text: desc });
	}
}

/**
 * Renders the "Upload behavior" section: upload triggers, supported file types (checkbox group),
 * and upload destination (radio group, S3 bucket vs local vault folder).
 */
export function renderUploadSection(containerEl: HTMLElement, ctx: SettingsContext): void {
	const details = makeSection(containerEl, "Upload behavior", true, "upload", "upload");
	const body = sectionBody(details);
	const settings = ctx.plugin.settings;

	// --- Upload triggers ---
	new Setting(body).setName("Upload triggers").setHeading();

	addToggle(
		body,
		"Upload pasted images",
		"Automatically upload images pasted into the editor.",
		[() => settings.uploadPastedImages, (v) => (settings.uploadPastedImages = v)],
		ctx,
	);
	addToggle(
		body,
		"Upload dragged images",
		"Automatically upload images dropped into the editor.",
		[() => settings.uploadOnDrag, (v) => (settings.uploadOnDrag = v)],
		ctx,
	);
	addToggle(
		body,
		"Upload newly created files",
		"Automatically upload files added to the vault (e.g. by sync tools). Off by default.",
		[() => settings.uploadOnCreate, (v) => (settings.uploadOnCreate = v)],
		ctx,
	);

	// --- Supported file types ---
	new Setting(body).setName("Supported file types").setHeading();

	const fileTypesGroup = body.createDiv({ cls: "r2-checkbox-group" });

	addCheckboxRow(fileTypesGroup, "Images", "Images are always uploaded.", {
		checked: true,
		disabled: true,
	});
	addCheckboxRow(fileTypesGroup, "Video", "", {
		checked: settings.uploadVideo,
		onChange: (v) => {
			settings.uploadVideo = v;
			void ctx.save();
		},
	});
	addCheckboxRow(fileTypesGroup, "Audio", "", {
		checked: settings.uploadAudio,
		onChange: (v) => {
			settings.uploadAudio = v;
			void ctx.save();
		},
	});
	addCheckboxRow(fileTypesGroup, "PDF", "", {
		checked: settings.uploadPdf,
		onChange: (v) => {
			settings.uploadPdf = v;
			void ctx.save();
		},
	});

	// --- Upload destination ---
	new Setting(body).setName("Upload destination").setHeading();

	const destGroup = body.createDiv({ cls: "r2-radio-group" });
	const radioName = "r2-upload-destination";

	const folderFieldWrap = body.createDiv({ cls: "r2-upload-destination-folder" });

	const renderFolderField = () => {
		folderFieldWrap.empty();
		if (!settings.localUpload) return;

		const folderSetting = new Setting(folderFieldWrap)
			.setName("Local vault folder")
			.setDesc("Vault-relative path where uploaded files are copied.");

		folderSetting.addText((text) => {
			text.setPlaceholder("E.g. Attachments/uploads").setValue(settings.localUploadFolder);
			text.onChange((v) => {
				settings.localUploadFolder = v;
				ctx.debouncedSave();
			});
			// eslint-disable-next-line sonarjs/constructor-for-side-effects -- attaches an input suggest dropdown; no reference needed
			new FolderSuggest(ctx, text.inputEl);
		});
	};

	const addRadioRow = (label: string, value: boolean) => {
		const id = `r2-upload-dest-${value ? "local" : "bucket"}`;
		const row = destGroup.createDiv({ cls: "r2-radio-row" });
		const input = row.createEl("input", {
			type: "radio",
			attr: { id, name: radioName },
		});
		input.checked = settings.localUpload === value;
		input.addEventListener("change", () => {
			if (!input.checked) return;
			settings.localUpload = value;
			void ctx.save();
			renderFolderField();
		});
		row.createEl("label", { text: label, attr: { for: id } }).addClass("r2-radio-label");
	};

	addRadioRow("S3-compatible bucket", false);
	addRadioRow("Local vault folder", true);

	renderFolderField();

	// --- Ignore pattern ---
	new Setting(body)
		.setName("Ignore pattern")
		.setDesc("Glob patterns to skip, comma-separated. E.g. Private/*, **/drafts/**")
		.addText((text) =>
			text
				.setPlaceholder("Private/*, **/drafts/**")
				.setValue(settings.ignorePattern)
				.onChange((v) => {
					settings.ignorePattern = v;
					ctx.debouncedSave();
				}),
		);
}
