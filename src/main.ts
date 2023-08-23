import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { StateField } from '@codemirror/state';

import * as MathLinks from 'obsidian-mathlinks'
import * as Dataview from 'obsidian-dataview';

import { MathContextSettings, DEFAULT_SETTINGS, ExtraSettings, DEFAULT_EXTRA_SETTINGS } from './settings/settings';
import { MathSettingTab } from "./settings/tab";
import { MathCallout, insertMathCalloutCallback } from './math_callouts';
import { ContextSettingModal, MathCalloutModal } from './modals';
import { insertDisplayMath } from './key';
import { DisplayMathRenderChild, buildEquationNumberPlugin } from './equation_number';
import { mathPreviewInfoField, inlineMathPreview, displayMathPreviewForCallout, displayMathPreviewForQuote } from './math_live_preview_in_callouts';
import { LinkedNotesIndexer, VaultIndexer } from './indexer';
import { mathCalloutMetadataHiderPlulgin } from './math_callout_metadata_hider';
import { iterDescendantFiles } from './utils';
import { proofPositionFieldFactory, proofDecorationFactory, ProofProcessor, ProofPosition, proofFoldFactory, insertProof } from './proof';


export const VAULT_ROOT = '/';


export default class MathBooster extends Plugin {
	settings: Record<string, Partial<MathContextSettings>>;
	extraSettings: ExtraSettings;
	excludedFiles: string[];
	oldLinkMap: Dataview.IndexMap;
	proofPositionField: StateField<ProofPosition[]>;

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
				const changedFile = args[1];
				if (changedFile instanceof TFile) {
					await (new LinkedNotesIndexer(this.app, this, changedFile)).run();
				}
				this.setOldLinkMap();
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("math-booster:local-settings-updated", async (file) => {
				const promises: Promise<void>[] = [];
				iterDescendantFiles(
					file,
					(descendantFile) => {
						promises.push((new LinkedNotesIndexer(this.app, this, descendantFile)).run());
					},
					"md"
				);
				await Promise.all(promises);
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("math-booster:global-settings-updated", async () => {
				await (new VaultIndexer(this.app, this)).run();
			})
		);


		/** Update settings when file renamed/created */

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.settings[file.path] = this.settings[oldPath];
				delete this.settings[oldPath];

				const index = this.excludedFiles.indexOf(oldPath);
				if (index >= 0) {
					this.excludedFiles.splice(index, 1);
					this.excludedFiles.push(file.path);
				}
			})
		)

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file.path in this.settings) {
					delete this.settings[file.path];
				}
				const index = this.excludedFiles.indexOf(file.path);
				if (index >= 0) {
					this.excludedFiles.splice(index, 1);
				}
			})
		)


		/** Commands */

		this.addCommand({
			id: 'insert-display-math',
			name: 'Insert display math',
			editorCallback: insertDisplayMath,
		});

		this.addCommand({
			id: 'insert-math-callout',
			name: 'Insert math callout',
			editorCallback: async (editor, context) => {
				if (context instanceof MarkdownView) {
					const modal = new MathCalloutModal(
						this.app,
						this,
						context.file,
						(config) => {
							if (context.file) {
								insertMathCalloutCallback(this, editor, config, context.file);
							}
						},
						"Insert",
						"Insert math callout",
					).open();
				}
			}
		});

		this.addCommand({
			id: 'open-local-settings-for-current-note',
			name: 'Open local settings for the current note',
			editorCallback: (editor, context) => {
				if (context instanceof MarkdownView) {
					const modal = new ContextSettingModal(this.app, this, context.file);
					modal.open();
				}
			}
		});

		this.addCommand({
			id: 'insert-proof', 
			name: 'Insert proof', 
			editorCallback: (editor, context) => insertProof(this, editor, context)
		});


		/** Editor Extensions */

		// hide > [!math|{"type":"theorem", ...}]
		this.registerEditorExtension(mathCalloutMetadataHiderPlulgin);
		// equation number
		this.registerEditorExtension(buildEquationNumberPlugin(this));
		// math preview in callouts and quotes
		this.registerEditorExtension(mathPreviewInfoField);
		this.registerEditorExtension(inlineMathPreview);
		this.registerEditorExtension(displayMathPreviewForCallout);
		this.registerEditorExtension(displayMathPreviewForQuote);
		// proofs
		this.proofPositionField = proofPositionFieldFactory(this);
		this.registerEditorExtension(this.proofPositionField);
		this.registerEditorExtension(proofDecorationFactory(this));
		this.registerEditorExtension(proofFoldFactory(this));



		/** Markdown post processors */

		// for math callouts
		this.registerMarkdownPostProcessor(async (element, context) => {
			const callouts = element.querySelectorAll<HTMLElement>(".callout");

			for (let index = 0; index < callouts.length; index++) {
				const callout = callouts[index];

				const type = callout.getAttribute('data-callout');
				const metadata = callout.getAttribute('data-callout-metadata');

				if (metadata) {
					const isMathCallout = (type?.toLowerCase() == 'math');

					if (isMathCallout) {
						const settings = JSON.parse(metadata);
						const currentFile = this.app.vault.getAbstractFileByPath(context.sourcePath);

						if (currentFile instanceof TFile) {
							const mathCallout = new MathCallout(callout, this.app, this, settings, currentFile, context);
							await mathCallout.setRenderedTitleElements();
							context.addChild(mathCallout);
						}
					}
				}
			}
		});

		// for equation numbers
		this.registerMarkdownPostProcessor((element, context) => {
			const mjxElements = element.querySelectorAll<HTMLElement>('mjx-container.MathJax > mjx-math[display="true"]');
			if (mjxElements) {
				for (let i = 0; i < mjxElements.length; i++) {
					const mjxContainerEl = mjxElements[i].parentElement;
					if (mjxContainerEl) {
						context.addChild(
							new DisplayMathRenderChild(mjxContainerEl, this.app, this, context)
						);
					}
				}
			}
		});

		// for proof environments
		this.registerMarkdownPostProcessor(
			(element, context) => ProofProcessor(this.app, this, element, context),
		);
	}

	onunload() {
		MathLinks.deleteAPIAccount(this);
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		if (loadedData) {
			const { settings, extraSettings, excludedFiles } = loadedData;
			this.settings = Object.assign({}, { [VAULT_ROOT]: DEFAULT_SETTINGS }, settings);
			this.extraSettings = Object.assign({}, DEFAULT_EXTRA_SETTINGS, extraSettings);
			this.excludedFiles = excludedFiles;
		} else {
			this.settings = { [VAULT_ROOT]: DEFAULT_SETTINGS };
			this.extraSettings = DEFAULT_EXTRA_SETTINGS;
			this.excludedFiles = [];
		}
	}

	async saveSettings() {
		await this.saveData({
			version: this.manifest.version,
			settings: this.settings,
			extraSettings: this.extraSettings,
			excludedFiles: this.excludedFiles,
		});
	}

	assertDataview(): boolean {
		if (!Dataview.isPluginEnabled(this.app)) {
			new Notice(
				`${this.manifest.name}: Make sure Dataview is installed & enabled.`,
				10000
			);
			return false;
		}
		return true;
	}

	assertMathLinks(): boolean {
		if (!MathLinks.isPluginEnabled(this.app)) {
			new Notice(
				`${this.manifest.name}: Make sure MathLinks is installed & enabled.`,
				10000
			);
			return false;
		}
		return true;
	}

	getMathLinksAPI(): MathLinks.MathLinksAPIAccount | undefined {
		const account = MathLinks.getAPIAccount(this);
		if (account) {
			account.blockPrefix = "";
			account.enableFileNameBlockLinks = this.extraSettings.noteTitleInLink;
			return account;
		}
	}

	initializeIndex() {
		const indexStart = Date.now();
		this.setOldLinkMap();
		(new VaultIndexer(this.app, this)).run();
		const indexEnd = Date.now();
		console.log(`${this.manifest.name}: All math callouts and equations in the vault have been indexed in ${(indexEnd - indexStart) / 1000}s.`);
	}

	getNewLinkMap(): Dataview.IndexMap | undefined {
		return Dataview.getAPI(this.app)?.index.links;
	}

	setOldLinkMap() {
		const oldLinkMap = this.getNewLinkMap();
		if (oldLinkMap) {
			this.oldLinkMap = structuredClone(oldLinkMap);
		}
	}
}
