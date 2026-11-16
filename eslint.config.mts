import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	sonarjs.configs.recommended,
	{
		rules: {
			"sonarjs/cognitive-complexity": ["error", 20], // 設定認知複雜度門檻
			"sonarjs/no-duplicate-string": "off", // 插件在設定檔中常會誤報重複字串，暫時關閉
		}
	},
	{
		files: ["src/settings.ts"],
		rules: {
			// Keep the settings UI compatible with minAppVersion 1.6.6.
			// Revisit declarative settings when the minimum reaches Obsidian 1.13.0.
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
