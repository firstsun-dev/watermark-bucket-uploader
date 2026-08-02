import { setIcon } from "obsidian";
import type { SettingsContext } from "../context";
import { buildStatusLine, STATE_CLASS, STATE_ICON, type RowState } from "../status-logic";

/**
 * Renders (and registers for re-render via ctx.setStatusRenderer) a compact single-line
 * "Setup status" card at the top of the settings tab. Shows a verdict plus destination /
 * connection / watermark segments; when something needs attention, lists the specific
 * issues and offers a "Review setup" action that opens the relevant section.
 */
export function renderSetupStatus(containerEl: HTMLElement, ctx: SettingsContext): void {
	const card = containerEl.createDiv({ cls: "r2-status-card" });

	const paint = () => {
		card.empty();

		const s = ctx.plugin.settings;
		const line = buildStatusLine(s);

		const mainEl = card.createDiv({ cls: `r2-status-line ${STATE_CLASS[line.state]}` });
		const iconEl = mainEl.createSpan({ cls: "r2-status-icon" });
		setIcon(iconEl, STATE_ICON[line.state]);
		const verdictEl = mainEl.createSpan({ cls: "r2-status-verdict" });
		const summary = STATE_VERDICT[line.state];
		verdictEl.createSpan({ cls: "r2-status-verdict-text", text: summary });
		verdictEl.createSpan({ cls: "r2-status-segments", text: " · " + line.segments.join(" · ") });

		if (line.state !== "good" && line.issues.length > 0) {
			const detailEl = card.createDiv({ cls: "r2-status-issues" });
			for (const issue of line.issues) {
				detailEl.createDiv({ cls: "r2-status-issue", text: issue });
			}
			const reviewBtn = detailEl.createEl("button", {
				cls: "r2-status-review-btn",
				text: "Review setup",
			});
			reviewBtn.addEventListener("click", () => ctx.focusFirstOpenSection());
		}
	};

	ctx.setStatusRenderer(paint);
	paint();
}

const STATE_VERDICT: Record<RowState, string> = {
	good: "Ready",
	attention: "Needs attention",
	neutral: "Not configured",
};

export type { RowState };