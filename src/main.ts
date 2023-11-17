import { MarkdownView, Plugin, TFile } from 'obsidian';
import { StateField } from '@codemirror/state';

import * as MathLinks from 'obsidian-mathlinks';

import { MathContextSettings, DEFAULT_SETTINGS, ExtraSettings, DEFAULT_EXTRA_SETTINGS, UNION_TYPE_MATH_CONTEXT_SETTING_KEYS, UNION_TYPE_EXTRA_SETTING_KEYS } from 'settings/settings';
import { MathSettingTab } from "settings/tab";
import { CleverRefProvider } from 'cleverref';
import { insertTheoremCalloutCallback, createTheoremCalloutFirstLineDecorator, theoremCalloutNumberingViewPlugin, theoremCalloutPostProcessor } from 'theorem_callouts';
import { ContextSettingModal, TheoremCalloutModal } from 'settings/modals';
import { insertDisplayMath } from 'key';
import { buildEquationNumberPlugin, equationNumberProcessor } from 'equation_number';
import { mathPreviewInfoField, inlineMathPreview, displayMathPreviewForCallout, displayMathPreviewForQuote, hideDisplayMathPreviewInQuote } from 'math_live_preview_in_callouts';
import { getMarkdownPreviewViewEl, getMarkdownSourceViewEl, isPluginOlderThan } from 'utils/obsidian';
import { getProfile, staticifyEqNumber } from 'utils/plugin';
import { proofPositionFieldFactory, proofDecorationFactory, ProofProcessor, ProofPosition, proofFoldFactory, insertProof } from './proof';
import { MathIndexManager } from './index/manager';
import { DependencyNotificationModal, MigrationModal } from 'notice';
import { LinkAutocomplete } from 'search/editor-suggest';
import { ActiveNoteSearchCore, RecentNotesSearchCore, WholeVaultEquationSearchCore, WholeVaultTheoremEquationSearchCore, WholeVaultTheoremSearchCore } from 'search/core';
import { MathSearchModal } from 'search/modal';


export const VAULT_ROOT = '/';


export default class MathBooster extends Plugin {
	settings: Record<string, Partial<MathContextSettings>>;
	extraSettings: ExtraSettings;
	excludedFiles: string[];
	proofPositionField: StateField<ProofPosition[]>;
	dependencies: Record<string, string> = {
		"mathlinks": "0.5.1",
		// "dataview": "0.5.56",
	};
	indexManager: MathIndexManager;

	async onload() {

		/** Settings */

		const data = await this.loadData();
		const first = data === null;
		const { version } = data ?? {};

		await this.loadSettings();
		await this.saveSettings();
		this.addSettingTab(new MathSettingTab(this.app, this));

		/** Dependencies check */

		this.app.workspace.onLayoutReady(async () => {
			const dependenciesOK = Object.keys(this.dependencies).every((id) => this.checkDependency(id));
			const v1 = !first && ((version as string | undefined)?.startsWith("1.") ?? true);

			if (!dependenciesOK || v1) {
				new DependencyNotificationModal(this, dependenciesOK, v1).open();
			}
		});


		/** Indexing */

		this.addChild((this.indexManager = new MathIndexManager(this, this.extraSettings)));
		this.app.workspace.onLayoutReady(async () => this.indexManager.initialize());
		// @ts-ignore
		(window['mathIndex'] = this.indexManager.index) && this.register(() => delete window['mathIndex'])

		// wait until the layout is ready to ensure MathLinks has been loaded when calling addProvider()
		this.app.workspace.onLayoutReady(() => {
			this.addChild(
				MathLinks.addProvider(this.app, (mathLinks) => new CleverRefProvider(mathLinks, this))
			);	
		});



		this.registerEvent(
			this.app.metadataCache.on("math-booster:local-settings-updated", async (file) => {
				// Add profile's tags as CSS classes
				this.app.workspace.iterateRootLeaves((leaf) => {
					if (leaf.view instanceof MarkdownView) {
						this.setProfileTagAsCSSClass(leaf.view);
					}
				});
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("math-booster:global-settings-updated", async () => {
				// await (new VaultIndexer(this.app, this)).run();

				// Add profile's tags as CSS classes
				this.app.workspace.iterateRootLeaves((leaf) => {
					if (leaf.view instanceof MarkdownView) {
						this.setProfileTagAsCSSClass(leaf.view);
					}
				});
			})
		);


		/** Add profile's tags as CSS classes */

		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.iterateRootLeaves((leaf) => {
				if (leaf.view instanceof MarkdownView) {
					this.setProfileTagAsCSSClass(leaf.view);
				}
			});
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView) {
					this.setProfileTagAsCSSClass(leaf.view);
				}
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
			id: 'insert-theorem-callout',
			name: 'Insert theorem callout',
			editorCallback: async (editor, context) => {
				if (context.file) {
					new TheoremCalloutModal(
						this.app, this, context.file,
						(config) => {
							if (context.file) {
								insertTheoremCalloutCallback(editor, config);
							}
						},
						"Insert", "Insert theorem callout",
					).open();
				}
			}
		});

		this.addCommand({
			id: 'search',
			name: 'Search',
			callback: () => {
				new MathSearchModal(this).open();
			}
		})

		this.addCommand({
			id: 'open-local-settings-for-current-note',
			name: 'Open local settings for the current note',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.file) {
					new ContextSettingModal(this.app, this, view.file).open();
				}
			}
		});

		this.addCommand({
			id: 'insert-proof',
			name: 'Insert proof',
			editorCallback: (editor, context) => insertProof(this, editor, context)
		});

		this.addCommand({
			id: 'convert-equation-number-to-tag',
			name: 'Convert equation numbers in the current note to static \\tag{}',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					staticifyEqNumber(this, file);
				}
			}
		});

		this.addCommand({
			id: 'migrate-from-v1',
			name: 'Migrate from version 1',
			callback: () => {
				new MigrationModal(this).open();
			}
		});


		/** Editor Extensions */

		// hide > [!math|{"type":"theorem", ...}]
		this.registerEditorExtension(theoremCalloutNumberingViewPlugin);
		this.registerEditorExtension(createTheoremCalloutFirstLineDecorator(this));
		// equation number
		this.registerEditorExtension(buildEquationNumberPlugin(this));
		// math preview in callouts and quotes
		this.registerEditorExtension(mathPreviewInfoField);
		this.registerEditorExtension(inlineMathPreview);
		this.registerEditorExtension(displayMathPreviewForCallout);
		this.registerEditorExtension(displayMathPreviewForQuote);
		this.registerEditorExtension(hideDisplayMathPreviewInQuote);
		// proofs
		this.proofPositionField = proofPositionFieldFactory(this);
		this.registerEditorExtension(this.proofPositionField);
		this.registerEditorExtension(proofDecorationFactory(this));
		this.registerEditorExtension(proofFoldFactory(this));


		/** Markdown post processors */

		// for theorem callouts
		this.registerMarkdownPostProcessor(theoremCalloutPostProcessor(this));

		// for equation numbers
		this.registerMarkdownPostProcessor(equationNumberProcessor(this));

		// for proof environments
		this.registerMarkdownPostProcessor(
			(element, context) => ProofProcessor(this.app, this, element, context),
		);


		/** Theorem/equation link autocompletion */
		this.registerLinkAutocomplete();

		/** File menu */

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addSeparator()
					.addItem((item) => {
						item.setTitle(`${this.manifest.name}: Open local settings`)
							.onClick(() => {
								new ContextSettingModal(this.app, this, file).open();
							});
					})
					.addSeparator();
			})
		);
	}

	onunload() {
		MathLinks.deleteAPIAccount(this);
	}

	async loadSettings() {
		this.settings = { [VAULT_ROOT]: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) };
		this.extraSettings = JSON.parse(JSON.stringify(DEFAULT_EXTRA_SETTINGS));
		this.excludedFiles = [];
		// this.projectManager = new ProjectManager(this);

		const loadedData = await this.loadData();
		if (loadedData) {
			const { settings, extraSettings, excludedFiles,
				// dumpedProjects 
			} = loadedData;
			for (const path in settings) {
				if (path != VAULT_ROOT) {
					this.settings[path] = {};
				}
				for (const _key in DEFAULT_SETTINGS) {
					const key = _key as keyof MathContextSettings;
					let val = settings[path][key];
					if (val !== undefined) {
						if (key in UNION_TYPE_MATH_CONTEXT_SETTING_KEYS) {
							const allowableValues = UNION_TYPE_MATH_CONTEXT_SETTING_KEYS[key];
							if (!(allowableValues?.includes(val))) {
								// invalid value encountered, substitute the default value instead
								val = DEFAULT_SETTINGS[key];
							}
						}
						if (typeof val == typeof DEFAULT_SETTINGS[key]) {
							// @ts-ignore
							this.settings[path][key] = val;
						}
					}
				}
			}

			for (const _key in DEFAULT_EXTRA_SETTINGS) {
				const key = _key as keyof ExtraSettings;
				let val = extraSettings[key];
				if (val !== undefined) {
					if (key in UNION_TYPE_EXTRA_SETTING_KEYS) {
						const allowableValues = UNION_TYPE_EXTRA_SETTING_KEYS[key];
						if (!(allowableValues?.includes(val))) {
							val = DEFAULT_EXTRA_SETTINGS[key];
						}
					}
					if (typeof val == typeof DEFAULT_EXTRA_SETTINGS[key]) {
						(this.extraSettings[key] as ExtraSettings[keyof ExtraSettings]) = val;
					}
				}
			}

			this.excludedFiles = excludedFiles;

			// At the time the plugin is loaded, the data vault is not ready and 
			// vault.getAbstractFile() returns null for any path.
			// So we have to wait for the vault to start up and store a dumped version of the projects until then.
			// this.projectManager = new ProjectManager(this, dumpedProjects);
		}
	}

	async saveSettings() {
		await this.saveData({
			version: this.manifest.version,
			settings: this.settings,
			extraSettings: this.extraSettings,
			excludedFiles: this.excludedFiles,
			// dumpedProjects: this.projectManager.dump(),
		});
	}

	registerLinkAutocomplete() {
		if (this.extraSettings.enableSuggest) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerSuggest ?? DEFAULT_EXTRA_SETTINGS.triggerSuggest,
				(parent) => new WholeVaultTheoremEquationSearchCore(parent)
			));
		}
		if (this.extraSettings.enableTheoremSuggest) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerTheoremSuggest ?? DEFAULT_EXTRA_SETTINGS.triggerTheoremSuggest,
				(parent) => new WholeVaultTheoremSearchCore(parent)
			));
		}
		if (this.extraSettings.enableEquationSuggest) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerEquationSuggest ?? DEFAULT_EXTRA_SETTINGS.triggerEquationSuggest,
				(parent) => new WholeVaultEquationSearchCore(parent)
			));
		}

		if (this.extraSettings.enableSuggestRecentNotes) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerSuggestRecentNotes ?? DEFAULT_EXTRA_SETTINGS.triggerSuggestRecentNotes,
				(parent) => new RecentNotesSearchCore(parent, 'both')
			));
		}
		if (this.extraSettings.enableTheoremSuggestRecentNotes) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerTheoremSuggestRecentNotes ?? DEFAULT_EXTRA_SETTINGS.triggerTheoremSuggestRecentNotes,
				(parent) => new RecentNotesSearchCore(parent, 'theorem')
			));
		}
		if (this.extraSettings.enableEquationSuggestRecentNotes) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerEquationSuggestRecentNotes ?? DEFAULT_EXTRA_SETTINGS.triggerEquationSuggestRecentNotes,
				(parent) => new RecentNotesSearchCore(parent, 'equation')
			));
		}

		if (this.extraSettings.enableSuggestActiveNote) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerSuggestActiveNote ?? DEFAULT_EXTRA_SETTINGS.triggerSuggestActiveNote,
				(parent) => new ActiveNoteSearchCore(parent, 'both')
			));
		}
		if (this.extraSettings.enableTheoremSuggestActiveNote) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerTheoremSuggestActiveNote ?? DEFAULT_EXTRA_SETTINGS.triggerTheoremSuggestActiveNote,
				(parent) => new ActiveNoteSearchCore(parent, 'theorem')
			));
		}
		if (this.extraSettings.enableEquationSuggestActiveNote) {
			this.registerEditorSuggest(new LinkAutocomplete(this,
				() => this.extraSettings.triggerEquationSuggestActiveNote ?? DEFAULT_EXTRA_SETTINGS.triggerEquationSuggestActiveNote,
				(parent) => new ActiveNoteSearchCore(parent, 'equation')
			));
		}
	}

	/**
	 * Return true if the required plugin with the specified id is enabled and its version matches the requriement.
	 * @param id 
	 * @returns 
	 */
	checkDependency(id: string): boolean {
		if (!this.app.plugins.enabledPlugins.has(id)) {
			return false;
		}
		const depPlugin = this.app.plugins.getPlugin(id);
		if (depPlugin) {
			return !isPluginOlderThan(depPlugin, this.dependencies[id])
		}
		return false;
	}

	setProfileTagAsCSSClass(view: MarkdownView) {
		if (!view.file) return;
		const profile = getProfile(this, view.file);
		const classes = profile.meta.tags.map((tag) => `math-booster-${tag}`);
		for (const el of [getMarkdownSourceViewEl(view), getMarkdownPreviewViewEl(view)]) {
			if (el) {
				el.classList.forEach((cls) => {
					if (cls.startsWith("math-booster-")) {
						el.classList.remove(cls);
					}
				});
				el?.addClass(...classes);
			}
		}
	}
}
