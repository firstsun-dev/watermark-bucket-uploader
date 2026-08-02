import { ButtonComponent, Notice, setIcon } from "obsidian";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import type { SettingsContext } from "../context";
import type { R2UploaderSettings } from "../types";
import { PROVIDER_PRESETS } from "../provider-presets";

type TestState = "idle" | "loading" | "success" | "failure";

/** Formats a timestamp as a short relative time ("just now", "5m ago", …), falling back to a locale string past a day. */
function formatRelativeTime(timestampMs: number): string {
	const diffMs = Date.now() - timestampMs;
	const diffSec = Math.round(diffMs / 1000);
	if (diffSec < 5) return "just now";
	if (diffSec < 60) return `${diffSec}s ago`;
	const diffMin = Math.round(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHour = Math.round(diffMin / 60);
	if (diffHour < 24) return `${diffHour}h ago`;
	return new Date(timestampMs).toLocaleString();
}

/**
 * Self-contained "Connection test" block: a button plus a persistent aria-live status
 * region below it. Unlike the old cycling-button-text approach, success/failure state
 * stays visible until the user re-tests (or changes a field, which marks it stale).
 */
export function renderConnectionTest(container: HTMLElement, ctx: SettingsContext): void {
	const wrapper = container.createDiv({ cls: "r2-connection-test" });

	let state: TestState = "idle";
	let errorMessage = "";

	const render = () => {
		wrapper.empty();
		wrapper.removeClass("r2-success", "r2-error");

		const settings = ctx.plugin.settings;

		// Reflect the last known test result on the wrapper so the colored border/background
		// from `.r2-connection-test.r2-success/.r2-error` applies; transient states below add it too.
		if (state === "success") wrapper.addClass("r2-success");
		else if (state === "failure") wrapper.addClass("r2-error");
		else if (settings.lastConnectionTestSuccess === true && !settings.connectionNeedsRetest) wrapper.addClass("r2-success");
		else if (settings.lastConnectionTestSuccess === false) wrapper.addClass("r2-error");

		const controlsEl = wrapper.createDiv({ cls: "r2-connection-test-controls" });

		const runTest = async () => {
			state = "loading";
			render();

			const client = ctx.plugin.s3;
			const bucket = settings.bucket;
			const started = Date.now();
			try {
				if (!client) throw new Error("S3 client not initialized. Check your connection settings.");
				await client.send(new HeadBucketCommand({ Bucket: bucket }));
				const latencyMs = Date.now() - started;

				settings.lastConnectionTestSuccess = true;
				settings.lastConnectionTestAt = Date.now();
				settings.lastConnectionTestBucket = bucket;
				settings.lastConnectionTestLatencyMs = latencyMs;
				settings.lastConnectionTestMessage = undefined;
				settings.connectionNeedsRetest = false;
				await ctx.save();
				ctx.refreshSetupStatus();

				state = "success";
				new Notice("Connection successful!");
			} catch (err: unknown) {
				console.error(err);
				const message = err instanceof Error ? err.message : String(err);

				settings.lastConnectionTestSuccess = false;
				settings.lastConnectionTestMessage = message;
				await ctx.save();
				ctx.refreshSetupStatus();

				state = "failure";
				errorMessage = message;
				new Notice("Connection failed: " + message);
			}
			render();
		};

		const button = new ButtonComponent(controlsEl)
			.setButtonText(state === "loading" ? "Testing…" : "Test connection")
			.setCta()
			.onClick(() => {
				void runTest();
			});
		button.setDisabled(state === "loading");
		if (state === "loading") {
			button.buttonEl.setAttribute("aria-busy", "true");
			const spinner = createSpan({ cls: "r2-spinner" });
			setIcon(spinner, "loader-2");
			button.buttonEl.prepend(spinner);
		} else {
			button.buttonEl.removeAttribute("aria-busy");
		}

		const statusEl = wrapper.createDiv({ cls: "r2-connection-status" });
		statusEl.setAttribute("aria-live", "polite");

		if (state === "idle" && settings.connectionNeedsRetest) {
			// Stale from a prior session/render — show "needs retest" without discarding the last known bucket.
			const notice = statusEl.createDiv({ cls: "r2-connection-status-block r2-connection-status-stale" });
			notice.createSpan({ cls: "r2-connection-status-title", text: "⚠ Needs retest" });
			const detail = settings.lastConnectionTestBucket
				? `Settings changed since last successful test of "${settings.lastConnectionTestBucket}".`
				: "Connection settings changed. Test again to verify access.";
			notice.createDiv({ cls: "r2-connection-status-detail", text: detail });
		} else if (state === "idle" && settings.lastConnectionTestSuccess && !settings.connectionNeedsRetest) {
			renderSuccessBlock(statusEl, settings);
		} else if (state === "idle" && settings.lastConnectionTestSuccess === false && settings.lastConnectionTestMessage) {
			renderFailureBlock(statusEl, settings.lastConnectionTestMessage, () => void runTest());
		} else if (state === "success") {
			renderSuccessBlock(statusEl, settings);
		} else if (state === "failure") {
			renderFailureBlock(statusEl, errorMessage, () => void runTest());
		}
		// state === "idle" with no prior test result, or state === "loading": nothing persistent to show.
	};

	const renderSuccessBlock = (statusEl: HTMLElement, settings: R2UploaderSettings) => {
		const block = statusEl.createDiv({ cls: "r2-connection-status-block r2-success" });
		block.createDiv({
			cls: "r2-connection-status-title",
			text: `✓ Connected to bucket "${settings.lastConnectionTestBucket ?? settings.bucket}"`,
		});
		const preset = PROVIDER_PRESETS[settings.storageProvider];
		const latency = settings.lastConnectionTestLatencyMs;
		const latencySuffix = latency !== undefined ? " · " + latency + "ms" : "";
		block.createDiv({
			cls: "r2-connection-status-detail",
			text: preset.label + latencySuffix,
		});
		if (settings.lastConnectionTestAt) {
			block.createDiv({
				cls: "r2-connection-status-meta",
				text: `Last tested: ${formatRelativeTime(settings.lastConnectionTestAt)}`,
			});
		}
	};

	const renderFailureBlock = (statusEl: HTMLElement, message: string, onRetry: () => void) => {
		const block = statusEl.createDiv({ cls: "r2-connection-status-block r2-error" });
		block.createDiv({ cls: "r2-connection-status-title", text: "✕ Connection failed" });
		const pre = block.createEl("pre", { cls: "r2-connection-status-error" });
		pre.setAttribute("role", "alert");
		pre.textContent = message;
		const retryBtn = new ButtonComponent(block).setButtonText("Test again").onClick(onRetry);
		retryBtn.buttonEl.addClass("r2-connection-retry-btn");
	};

	render();
}
