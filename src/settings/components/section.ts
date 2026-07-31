import { setIcon } from "obsidian";

/**
 * Creates a collapsible <details>/<summary> section card with an icon on the left
 * and a chevron on the right (rotated via CSS when the section is open).
 */
export function makeSection(
	parent: HTMLElement,
	label: string,
	open = false,
	icon?: string,
): HTMLElement {
	const details = parent.createEl("details", { cls: "r2-section" });
	if (open) details.setAttribute("open", "");
	const summary = details.createEl("summary", { cls: "r2-section-summary" });
	summary.setAttribute("tabindex", "0");

	if (icon) {
		const iconEl = summary.createSpan({ cls: "r2-section-icon" });
		setIcon(iconEl, icon);
	}

	summary.createSpan({ cls: "r2-section-title", text: label });

	const chevron = summary.createSpan({ cls: "r2-chevron" });
	setIcon(chevron, "chevron-right");

	return details;
}

/** Returns the (lazily created) body container for section content, keeping summary layout stable. */
export function sectionBody(details: HTMLElement): HTMLElement {
	return details.createDiv({ cls: "r2-section-body" });
}
