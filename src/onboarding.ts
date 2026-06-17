import { App, Modal } from "obsidian";

/**
 * Per-release notes shown by WhatsNewModal, keyed by plugin version.
 * Add an entry here whenever a release ships something worth announcing.
 */
export const CHANGELOG: Record<string, string[]> = {};

function parseVersion(v: string): number[] {
	return v.split(".").map((n) => parseInt(n, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
	const pa = parseVersion(a);
	const pb = parseVersion(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export function getChangesSince(
	lastSeenVersion: string,
	currentVersion: string,
	changelog: Record<string, string[]> = CHANGELOG,
): string[] {
	return Object.keys(changelog)
		.filter((v) => compareVersions(v, lastSeenVersion) > 0 && compareVersions(v, currentVersion) <= 0)
		.sort(compareVersions)
		.flatMap((v) => changelog[v]);
}

export class WelcomeModal extends Modal {
	constructor(app: App, private onOpenSettings: () => void) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Welcome to watermark bucket uploader" });
		contentEl.createEl("p", {
			text: "Paste or drop an image into a note and it's uploaded straight to your S3-compatible bucket (cloudflare r2, aws S3, etc).",
		});
		const list = contentEl.createEl("ul");
		list.createEl("li", { text: "Webp conversion and compression before upload" });
		list.createEl("li", { text: "Text and logo watermarks, with a live preview" });
		list.createEl("li", { text: "Per-note overrides via frontmatter" });
		contentEl.createEl("p", {
			text: "Start by connecting your bucket in the plugin settings.",
		});

		const buttonRow = contentEl.createDiv({ cls: "r2-onboarding-buttons" });
		const settingsBtn = buttonRow.createEl("button", { text: "Open settings", cls: "mod-cta" });
		settingsBtn.addEventListener("click", () => {
			this.close();
			this.onOpenSettings();
		});
		const dismissBtn = buttonRow.createEl("button", { text: "Maybe later" });
		dismissBtn.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class WhatsNewModal extends Modal {
	constructor(app: App, private version: string, private changes: string[]) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: `What's new in v${this.version}` });
		const list = contentEl.createEl("ul");
		for (const change of this.changes) {
			list.createEl("li", { text: change });
		}
		const dismissBtn = contentEl.createEl("button", { text: "Got it", cls: "mod-cta" });
		dismissBtn.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
