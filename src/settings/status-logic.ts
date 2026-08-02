import type { R2UploaderSettings } from "./types";

export type RowState = "good" | "attention" | "neutral";

/** Maps an internal row state to the CSS modifier class the status card uses. */
export const STATE_CLASS: Record<RowState, string> = {
	good: "r2-status-success",
	attention: "r2-status-warning",
	neutral: "r2-status-muted",
};

export const STATE_ICON: Record<RowState, string> = {
	good: "check-circle-2",
	attention: "alert-circle",
	neutral: "circle",
};

export interface StatusRow {
	label: string;
	state: RowState;
	detail: string;
}

/** True when a text or logo watermark is switched on. */
function isWatermarkOn(s: R2UploaderSettings): boolean {
	return s.watermarkEnabled || s.watermarkLogoEnabled;
}

/** Readiness for whichever watermark layers are enabled (text, logo, or both). */
function watermarkRow(s: R2UploaderSettings): StatusRow {
	if (!isWatermarkOn(s)) {
		return { label: "Watermark", state: "neutral", detail: "Disabled" };
	}
	const textReady = !s.watermarkEnabled || !!s.watermarkText.trim();
	const logoReady = !s.watermarkLogoEnabled || !!s.watermarkLogoPath.trim();
	if (textReady && logoReady) {
		return { label: "Watermark", state: "good", detail: "Configured" };
	}
	return {
		label: "Watermark",
		state: "attention",
		detail: !textReady ? "Watermark text is empty" : "Logo enabled but no logo selected",
	};
}

/**
 * Computes the setup-status rows. Adapts to the chosen upload destination: a local
 * vault-folder destination skips the S3 credentials / bucket-connection checks that a
 * pure-local user could never satisfy.
 */
export function computeRows(s: R2UploaderSettings): StatusRow[] {
	if (s.localUpload) {
		const folderSet = !!s.localUploadFolder.trim();
		return [
			{
				label: "Upload destination",
				state: "good",
				detail: "Local vault folder",
			},
			{
				label: "Local folder",
				state: folderSet ? "good" : "attention",
				detail: folderSet ? "Configured" : "No folder chosen",
			},
			{
				label: "Public image URL",
				state: "neutral",
				detail: "Not used for local uploads",
			},
			watermarkRow(s),
		];
	}

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
		watermarkRow(s),
	];
}

export interface StatusSummary {
	text: string;
	state: RowState;
}

/** Single overall verdict shown at the bottom of the status card. */
export function computeSummary(s: R2UploaderSettings): StatusSummary {
	const rows = computeRows(s);

	if (s.localUpload) {
		// rows: [destination, localFolder, url, watermark]
		const folderRow = rows[1];
		if (folderRow.state === "good") {
			return { text: "Ready to upload", state: "good" };
		}
		return { text: "Needs attention", state: "attention" };
	}

	if (!s.accessKey && !s.secretKey) {
		return { text: "Not configured", state: "neutral" };
	}
	const credentialsRow = rows[0];
	const bucketRow = rows[1];
	if (credentialsRow.state === "good" && bucketRow.state === "good") {
		return { text: "Ready to upload", state: "good" };
	}
	return { text: "Needs attention", state: "attention" };
}