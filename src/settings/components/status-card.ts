import { setIcon } from "obsidian";
import type { SettingsContext } from "../context";

type RowState = "good" | "attention" | "neutral";

interface StatusRow {
	label: string;
	state: RowState;
	detail: string;
}

const STATE_ICON: Record<RowState, string> = {
	good: "check-circle-2",
	attention: "alert-circle",
	neutral: "circle",
};

function computeRows(ctx: SettingsContext): StatusRow[] {
	const s = ctx.plugin.settings;

	const credentialsGood = !!s.accessKey && !!s.secretKey;

	const bucketVerified = s.lastConnectionTestSuccess === true && !s.connectionNeedsRetest;
	let bucketState: RowState = "attention";
	let bucketDetail = "Not tested yet";
	if (s.connectionNeedsRetest && s.lastConnectionTestSuccess !== undefined) {
		bucketDetail = "Needs retest — settings changed since last test";
	} else if (bucketVerified) {
		bucketState = "good";
		bucketDetail = "Verified";
	} else if (s.lastConnectionTestSuccess === false) {
		bucketDetail = "Last test failed";
	}

	const hasCustomUrl = s.useCustomImageUrl && !!s.customImageUrl;
	const hasDerivableUrl = !s.useCustomEndpoint && !!s.region && !!s.bucket;
	const urlConfigured = hasCustomUrl || hasDerivableUrl;

	let watermarkState: RowState = "neutral";
	let watermarkDetail = "Watermarking disabled";
	if (s.watermarkEnabled) {
		const textReady = !!s.watermarkText.trim();
		const logoReady = !s.watermarkLogoEnabled || !!s.watermarkLogoPath.trim();
		if (textReady && logoReady) {
			watermarkState = "good";
			watermarkDetail = "Configured";
		} else {
			watermarkState = "attention";
			watermarkDetail = !textReady
				? "Watermark text is empty"
				: "Logo watermark enabled but no logo selected";
		}
	}

	return [
		{
			label: "Storage credentials configured",
			state: credentialsGood ? "good" : "attention",
			detail: credentialsGood ? "Access key and secret key set" : "Access key and/or secret key missing",
		},
		{
			label: "Bucket connection verified",
			state: bucketState,
			detail: bucketDetail,
		},
		{
			label: "Public image URL configured",
			state: urlConfigured ? "good" : "neutral",
			detail: urlConfigured ? "URL can be derived" : "Not configured (optional)",
		},
		{
			label: "Watermark ready",
			state: watermarkState,
			detail: watermarkDetail,
		},
	];
}

function computeSummary(rows: StatusRow[], ctx: SettingsContext): { text: string; state: RowState } {
	const s = ctx.plugin.settings;
	const credentialsRow = rows[0];
	const bucketRow = rows[1];

	if (!s.accessKey && !s.secretKey) {
		return { text: "Not configured", state: "neutral" };
	}
	if (credentialsRow.state === "good" && bucketRow.state === "good") {
		return { text: "Ready to upload", state: "good" };
	}
	return { text: "Needs attention", state: "attention" };
}

/**
 * Renders (and registers for re-render via ctx.setStatusRenderer) the "Setup status" card
 * shown at the top of the settings tab.
 */
export function renderSetupStatus(containerEl: HTMLElement, ctx: SettingsContext): void {
	const card = containerEl.createDiv({ cls: "r2-status-card" });

	const paint = () => {
		card.empty();

		card.createEl("h3", { text: "Setup status", cls: "r2-status-title" });

		const rows = computeRows(ctx);
		const list = card.createDiv({ cls: "r2-status-rows" });

		for (const row of rows) {
			const rowEl = list.createDiv({ cls: `r2-status-row r2-status-row-${row.state}` });
			const iconEl = rowEl.createSpan({ cls: "r2-status-icon" });
			setIcon(iconEl, STATE_ICON[row.state]);
			const textEl = rowEl.createDiv({ cls: "r2-status-text" });
			textEl.createSpan({ cls: "r2-status-label", text: row.label });
			textEl.createSpan({ cls: "r2-status-detail", text: row.detail });
		}

		const summary = computeSummary(rows, ctx);
		const summaryEl = card.createDiv({ cls: `r2-status-summary r2-status-summary-${summary.state}` });
		const summaryIcon = summaryEl.createSpan({ cls: "r2-status-icon" });
		setIcon(summaryIcon, STATE_ICON[summary.state]);
		summaryEl.createSpan({ cls: "r2-status-summary-text", text: summary.text });
	};

	ctx.setStatusRenderer(paint);
	paint();
}
