import type { Setting } from "obsidian";

const MESSAGE_CLASS = "r2-field-message";

/**
 * Attaches (or updates) a validation message below a Setting's control.
 * Errors get role="alert" so screen readers announce them; success/neutral messages don't.
 */
export function setFieldMessage(
	setting: Setting,
	message: string | null,
	kind: "error" | "success" | "neutral" = "error",
): void {
	let el = setting.settingEl.querySelector<HTMLElement>(`.${MESSAGE_CLASS}`);
	if (!message) {
		el?.remove();
		return;
	}
	if (!el) {
		el = setting.settingEl.createDiv({ cls: MESSAGE_CLASS });
	}
	el.textContent = message;
	el.toggleClass("r2-error", kind === "error");
	el.toggleClass("r2-success", kind === "success");
	if (kind === "error") {
		el.setAttribute("role", "alert");
	} else {
		el.removeAttribute("role");
	}
}

/** Marks a Setting's name label with a "Required" badge. */
export function markRequired(setting: Setting): void {
	setting.nameEl.createSpan({ cls: "r2-required-badge", text: "Required" });
}
