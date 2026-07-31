import type { SettingsContext } from "../context";

type TabId = "text" | "logo";

interface TabDef {
	id: TabId;
	base: string;
	enabledKey: "watermarkEnabled" | "watermarkLogoEnabled";
}

const TAB_DEFS: TabDef[] = [
	{ id: "text", base: "Text", enabledKey: "watermarkEnabled" },
	{ id: "logo", base: "Logo", enabledKey: "watermarkLogoEnabled" },
];

function tabLabel(def: TabDef, ctx: SettingsContext): string {
	const on = ctx.plugin.settings[def.enabledKey];
	return `${def.base} · ${on ? "On" : "Off"}`;
}

/**
 * Re-reads watermarkEnabled/watermarkLogoEnabled and updates the "· On/Off" suffix on
 * both tab labels. Call this after either enable toggle changes so the tab strip stays
 * in sync — `container` can be any ancestor of the rendered tab strip (e.g. the
 * `r2-watermark-controls` wrapper), it's found by `.r2-tab[data-tab-id]`.
 */
export function refreshWatermarkTabLabels(container: HTMLElement, ctx: SettingsContext): void {
	for (const def of TAB_DEFS) {
		const tabEl = container.querySelector<HTMLElement>(`.r2-tab[data-tab-id="${def.id}"]`);
		if (tabEl) tabEl.setText(tabLabel(def, ctx));
	}
}

/**
 * Generic two-tab strip (Text / Logo) with real tablist/tab/tabpanel semantics.
 * Panel contents are built once by the supplied builders; switching tabs only toggles
 * visibility and never touches watermarkEnabled/watermarkLogoEnabled — those stay owned
 * by toggles inside each panel.
 */
export function renderWatermarkTabs(
	container: HTMLElement,
	ctx: SettingsContext,
	textPanelBuilder: (panel: HTMLElement) => void,
	logoPanelBuilder: (panel: HTMLElement) => void,
): void {
	const wrap = container.createDiv({ cls: "r2-tabs" });

	const tablist = wrap.createDiv({ cls: "r2-tablist" });
	tablist.setAttribute("role", "tablist");
	tablist.setAttribute("aria-label", "Watermark type");

	const panelsWrap = wrap.createDiv({ cls: "r2-tabpanels" });

	const panelDefs: Record<TabId, HTMLElement> = {
		text: panelsWrap.createDiv({ cls: "r2-tabpanel" }),
		logo: panelsWrap.createDiv({ cls: "r2-tabpanel" }),
	};

	const tabEls: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;

	panelDefs.text.setAttribute("role", "tabpanel");
	panelDefs.text.id = "r2-watermark-tabpanel-text";
	panelDefs.text.setAttribute("aria-labelledby", "r2-watermark-tab-text");

	panelDefs.logo.setAttribute("role", "tabpanel");
	panelDefs.logo.id = "r2-watermark-tabpanel-logo";
	panelDefs.logo.setAttribute("aria-labelledby", "r2-watermark-tab-logo");

	function activate(id: TabId): void {
		for (const def of TAB_DEFS) {
			const active = def.id === id;
			const tabEl = tabEls[def.id];
			tabEl.setAttribute("aria-selected", active ? "true" : "false");
			tabEl.setAttribute("tabindex", active ? "0" : "-1");
			tabEl.toggleClass("is-active", active);
			panelDefs[def.id].toggleClass("is-hidden", !active);
			panelDefs[def.id].hidden = !active;
		}
	}

	TAB_DEFS.forEach((def, index) => {
		const tabEl = tablist.createDiv({ cls: "r2-tab" });
		tabEl.setAttribute("role", "tab");
		tabEl.setAttribute("data-tab-id", def.id);
		tabEl.id = `r2-watermark-tab-${def.id}`;
		tabEl.setAttribute("aria-controls", `r2-watermark-tabpanel-${def.id}`);
		tabEl.setText(tabLabel(def, ctx));
		tabEls[def.id] = tabEl;

		tabEl.addEventListener("click", () => activate(def.id));
		tabEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" || evt.key === " ") {
				evt.preventDefault();
				activate(def.id);
				return;
			}
			if (evt.key === "ArrowRight" || evt.key === "ArrowLeft") {
				evt.preventDefault();
				const nextIndex = evt.key === "ArrowRight"
					? (index + 1) % TAB_DEFS.length
					: (index - 1 + TAB_DEFS.length) % TAB_DEFS.length;
				const nextId = TAB_DEFS[nextIndex].id;
				activate(nextId);
				tabEls[nextId].focus();
			}
		});
	});

	textPanelBuilder(panelDefs.text);
	logoPanelBuilder(panelDefs.logo);

	activate("text");
}
