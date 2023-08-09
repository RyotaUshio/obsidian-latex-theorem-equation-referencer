import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';

import * as MathLinks from 'obsidian-mathlinks'
import * as Dataview from 'obsidian-dataview';

import { MathContextSettings, DEFAULT_SETTINGS } from './settings/settings';
import { MathSettingTab } from "./settings/tab";
import { getCurrentMarkdown, resolveSettings } from './utils';
import { MathCallout, insertMathCalloutCallback } from './math_callouts';
import { ContextSettingModal, MathCalloutModal } from './modals';
import { insertDisplayMath, insertInlineMath } from './key';
import { DisplayMathRenderChild, buildEquationNumberPlugin } from './equation_number';
import { blockquoteMathPreviewPlugin } from './math_live_preview_in_callouts';
import { ActiveNoteIndexer, LinkedNotesIndexer, VaultIndexer } from './indexer';


export const VAULT_ROOT = '/';


export default class MathBooster extends Plugin {
	settings: Record<string, MathContextSettings>;
	excludedFiles: string[];
	oldLinkMap: Dataview.IndexMap;

	async onload() {

		/** Settings */

		await this.loadSettings();
		this.addSettingTab(new MathSettingTab(this.app, this));


		/** Dependencies check */

		this.app.workspace.onLayoutReady(() => {
			this.assertDataview();
			this.assertMathLinks();
		});


		/** Indexing */

		// triggered if this plugin is enabled after launching the app
		this.app.workspace.onLayoutReady(() => {
			if (Dataview.getAPI(this.app)?.index.initialized) {
				this.initializeIndex()
			}
		})

		// triggered if this plugin is already enabled when launching the app
		this.registerEvent(
			this.app.metadataCache.on(
				"dataview:index-ready", 
				this.initializeIndex.bind(this)
			)
		);

		this.registerEvent(
			this.app.metadataCache.on("dataview:metadata-change", async (...args) => {
				let changedFile = args[1];
				if (changedFile instanceof TFile) {
					await (new LinkedNotesIndexer(this.app, this, changedFile)).run();
				}
				this.setOldLinkMap();
			})
		);


		/** Commands */

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
							if (cache) {
								// @ts-ignore
								let indexer = new ActiveNoteIndexer(this.app, this, view);
								indexer.run(cache);
							}
						}
					);
					modal.resolveDefaultSettings(view.file);
					modal.open();
				}
			}
		});


		/** Editor Extensions */

		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
				if (leaf.view instanceof MarkdownView) {
					let settings = resolveSettings(undefined, this, leaf.view.file);
					this.registerEditorExtension(buildEquationNumberPlugin(this.app, this, leaf.view, Boolean(settings.lineByLine)));
				}
			});
		});

		this.app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf) => {
			if (leaf.view instanceof MarkdownView) {
				let settings = resolveSettings(undefined, this, leaf.view.file);
				this.registerEditorExtension(buildEquationNumberPlugin(this.app, this, leaf.view, Boolean(settings.lineByLine)));
			}
		});

		this.registerEditorExtension(blockquoteMathPreviewPlugin);


		/** Markdown post processors */

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
			let mjxElements = element.querySelectorAll<HTMLElement>('mjx-container.MathJax > mjx-math[display="true"]');
			if (mjxElements) {
				for (let i = 0; i < mjxElements.length; i++) {
					let mjxContainerEl = mjxElements[i].parentElement;
					if (mjxContainerEl) {
						context.addChild(
							new DisplayMathRenderChild(
								mjxContainerEl,
								this.app,
								this,
								context
							)
						);
					}
				}
			}
		});
	}

	onunload() {
		this.getMathLinksAPI()?.deleteAccount();
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

	assertDataview(): boolean {
		if (!Dataview.isPluginEnabled(this.app)) {
			new Notice(
				`${this.manifest.name}: Make sure Dataview is installed & enabled.`,
				100000
			);
			return false;
		}
		return true;
	}

	assertMathLinks(): boolean {
		if (!MathLinks.isPluginEnabled(this.app)) {
			new Notice(
				`${this.manifest.name}: Make sure MathLinks is installed & enabled.`,
				100000
			);
			return false;
		}
		return true;
	}

	getMathLinksAPI(): MathLinks.MathLinksAPIAccount | undefined {
		let account = MathLinks.getAPIAccount(this);
		if (account) {
			account.blockPrefix = "";
			account.enableFileNameBlockLinks = false;
			return account;
		}
	}

	initializeIndex() {
		let indexStart = Date.now();
		this.setOldLinkMap();
		(new VaultIndexer(this.app, this)).run();
		let indexEnd = Date.now();
		console.log(`${this.manifest.name}: All the math callouts & equations in the vault have been indexed in ${(indexEnd - indexStart) / 1000}s`);	
	}

	getNewLinkMap(): Dataview.IndexMap | undefined {
		return Dataview.getAPI(this.app)?.index.links;
	}

	setOldLinkMap() {
		let oldLinkMap = this.getNewLinkMap();
		if (oldLinkMap) {
			this.oldLinkMap = structuredClone(oldLinkMap);
		}
	}
}
