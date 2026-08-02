import { setIcon } from "obsidian";
import type { SettingsContext } from "../context";
import { computeRows, computeSummary, STATE_CLASS, STATE_ICON, type RowState } from "../status-logic";

/**
 * Renders (and registers for re-render via ctx.setStatusRenderer) the "Setup status" card
 * shown at the top of the settings tab.
 */
export function renderSetupStatus(containerEl: HTMLElement, ctx: SettingsContext): void {
	const card = containerEl.createDiv({ cls: "r2-status-card" });

	const paint = () => {
		card.empty();

		card.createEl("h3", { text: "Setup status", cls: "r2-status-title" });

		const s = ctx.plugin.settings;
		const rows = computeRows(s);
		const list = card.createDiv({ cls: "r2-status-rows" });

		for (const row of rows) {
			const rowEl = list.createDiv({ cls: `r2-status-row ${STATE_CLASS[row.state]}` });
			const iconEl = rowEl.createSpan({ cls: "r2-status-icon" });
			setIcon(iconEl, STATE_ICON[row.state]);
			const textEl = rowEl.createDiv({ cls: "r2-status-text" });
			textEl.createSpan({ cls: "r2-status-label", text: row.label });
			textEl.createSpan({ cls: "r2-status-detail", text: row.detail });
		}

		const summary = computeSummary(s);
		const summaryEl = card.createDiv({ cls: `r2-status-summary ${STATE_CLASS[summary.state]}` });
		const summaryIcon = summaryEl.createSpan({ cls: "r2-status-icon" });
		setIcon(summaryIcon, STATE_ICON[summary.state]);
		summaryEl.createSpan({ cls: "r2-status-summary-text", text: summary.text });
	};

	ctx.setStatusRenderer(paint);
	paint();
}

export type { RowState };