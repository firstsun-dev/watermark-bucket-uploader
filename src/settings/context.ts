import type { App } from "obsidian";
import type R2UploaderPlugin from "../main";

/**
 * Shared services passed into every section/component renderer so save/preview/status
 * behavior (debouncing, dirty-tracking) stays centralized instead of re-implemented per section.
 */
export interface SettingsContext {
	app: App;
	plugin: R2UploaderPlugin;
	/** Saves immediately. Use for toggles, dropdowns, sliders. */
	save: () => Promise<void>;
	/** Saves after 300-500ms of inactivity. Use for free-text inputs. */
	debouncedSave: () => void;
	/** Re-renders the watermark preview canvas (already debounced internally). No-op until a renderer is registered. */
	refreshPreview: () => void;
	/** Registers the function that actually paints the preview canvas. Call with null on teardown. */
	setPreviewRenderer: (fn: (() => void | Promise<void>) | null) => void;
	/** Re-renders the "Setup status" card at the top of the settings tab. No-op until a renderer is registered. */
	refreshSetupStatus: () => void;
	/** Registers the function that repaints the setup status card. Call with null on teardown. */
	setStatusRenderer: (fn: (() => void) | null) => void;
	/** Marks the connection as needing a retest (call after any credential/endpoint change). Does not persist — pair with save/debouncedSave. */
	markConnectionDirty: () => void;
	/** Rebuilds the S3 client from current settings (call after credential/endpoint changes). */
	rebuildS3Client: () => void;
	/** Recomputes the public image URL base from current settings without rebuilding the S3 client or invalidating the connection test. */
	refreshImageUrlPath: () => void;
	/** Opens and scrolls to the primary setup section (Storage connection) — used by the status card's "Review setup" action. */
	focusFirstOpenSection: () => void;
}
