import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';

import { MathContextSettings, DEFAULT_SETTINGS, MathSettingTab, PLUGIN_NAME } from 'settings';
import { getCurrentMarkdown } from 'utils';
import { MathCallout, insertMathCalloutCallback } from 'math_callouts';
import { ContextSettingModal, MathCalloutModal } from 'modals';
import { insertDisplayMath, insertInlineMath } from 'key';
import { DisplayMathRenderChild, buildEquationNumberPlugin } from 'equation_number';
import { autoIndex, resolveSettings } from 'autoIndex';
import { blockquoteMathPreviewPlugin } from 'math_live_preview_in_callouts';
import { isPluginEnabled } from 'obsidian-dataview';


export const VAULT_ROOT = '/';


export default class MathPlugin extends Plugin {
	settings: Record<string, MathContextSettings>;
	excludedFiles: string[];


	async onload() {

		await this.loadSettings();

		this.addCommand({
			id: 'insert-inline-math',
			name: 'Insert Inline Math',
			editorCallback: insertInlineMath
		});

		this.addCommand({
			id: 'insert-display-math',
			name: 'Insert Display Math',
			editorCallback: (editor) => insertDisplayMath(editor, false, this.app)
		});

		this.addCommand({
			id: 'insert-math-callout',
			name: 'Insert Math Callout',
			editorCallback: async (editor, context) => {
				if (context instanceof MarkdownView) {
					let modal = new MathCalloutModal(
						this.app,
						this,
						context,
						(config) => {
							if (context.file) {
								insertMathCalloutCallback(this.app, this, editor, config, context.file);
							}
						},
						"Insert",
						"Insert a Math Callout",
					);
					modal.resolveDefaultSettings(getCurrentMarkdown(this.app));
					modal.open();
				}
			}
		});

		this.addCommand({
			id: 'open-local-settings-for-current-note',
			name: 'Open Local Settings for the Current Note',
			callback: () => {
				let view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					let modal = new ContextSettingModal(
						this.app,
						this, view.file.path,
						(settings) => {
							// @ts-ignore
							let cache = this.app.metadataCache.getCache(view.file.path);
							// @ts-ignore
							autoIndex(cache, view.editor, view.file, this);
						}
					);
					modal.resolveDefaultSettings(view.file);
					modal.open();
				}
			}
		});

		this.app.workspace.onLayoutReady(() => {
			if (!isPluginEnabled(this.app)) {
				new Notice(
					`${PLUGIN_NAME}: Make sure Dataview is installed & enabled.`, 
					100000
				);
			}
			// @ts-ignore
			if (!this.app.plugins.enabledPlugins.has("mathlinks")) {
				new Notice(
					`${PLUGIN_NAME}: Make sure MathLinks is installed & enabled.`, 
					100000
				);
			}
		});

		this.registerEvent(
			// @ts-ignore
			this.app.metadataCache.on("dataview:metadata-change",
				(type: string, file: TFile, oldPath?: string) => {
					let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
					let editor = activeView?.editor;
					let cache = this.app.metadataCache.getFileCache(file);
					if (type == 'update' && editor && activeView && file == activeView.file && cache) {
						autoIndex(cache, editor, file, this);
					}
				}
			)
		);

		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
				if (leaf.view instanceof MarkdownView) {
					let settings = resolveSettings(undefined, this, leaf.view.file);
					this.registerEditorExtension(buildEquationNumberPlugin(this.app, leaf.view.file.path, Boolean(settings.lineByLine)));
				}
			});
		});

		this.app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf) => {
			if (leaf.view instanceof MarkdownView) {
				let settings = resolveSettings(undefined, this, leaf.view.file);
				this.registerEditorExtension(buildEquationNumberPlugin(this.app, leaf.view.file.path, Boolean(settings.lineByLine)));
			}
		});

		this.registerEditorExtension(blockquoteMathPreviewPlugin);

		this.registerMarkdownPostProcessor(async (element, context) => {
			const callouts = element.querySelectorAll<HTMLElement>(".callout");

			for (let index = 0; index < callouts.length; index++) {
				let callout = callouts[index];

				let type = callout.getAttribute('data-callout');
				let metadata = callout.getAttribute('data-callout-metadata');
				if (metadata) {
					const isSmartCallout = (type?.toLowerCase() == 'math');

					if (isSmartCallout) {
						const settings = JSON.parse(metadata);

						let currentFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
						if (currentFile instanceof TFile) {
							let smartCallout = new MathCallout(callout, this.app, this, settings, currentFile);
							await smartCallout.setRenderedTitleElements();
							context.addChild(smartCallout);
						}
					}
				}
			}
		});

		this.registerMarkdownPostProcessor((element, context) => {
			let mjxElements = element.querySelectorAll<HTMLElement>('mjx-container.MathJax mjx-math[display="true"]');
			if (mjxElements) {
				for (let i = 0; i < mjxElements.length; i++) {
					let mjxEl = mjxElements[i];
					let renderChild = new DisplayMathRenderChild(mjxEl, this.app, this, context);
					context.addChild(renderChild);
				}
			}
		});

		this.registerEvent(this.app.metadataCache.on("changed", (file, data, cache) => {
			this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
				if (leaf.view instanceof MarkdownView && leaf.view.getMode() == 'preview') {
					leaf.view.previewMode.rerender(true);
				}
			});
		}));

		this.addSettingTab(new MathSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		let loadedData = await this.loadData();
		if (loadedData) {
			let { settings, excludedFiles } = loadedData;
			this.settings = Object.assign({}, { [VAULT_ROOT]: DEFAULT_SETTINGS }, settings);
			this.excludedFiles = excludedFiles;
		} else {
			this.settings = Object.assign({}, { [VAULT_ROOT]: DEFAULT_SETTINGS }, undefined);
			this.excludedFiles = [];
		}
	}

	async saveSettings() {
		await this.saveData({ settings: this.settings, excludedFiles: this.excludedFiles });
	}
}
