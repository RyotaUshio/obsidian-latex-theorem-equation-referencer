import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	parseLinktext,
	MetadataCache,
	FileSystemAdapter,
	getLinkpath,
	TFile,
	LinkCache,
	MarkdownRenderChild,
	loadMathJax,
	renderMath,
	finishRenderMath,
	FuzzySuggestModal,
	TFolder,
	resolveSubpath,
} from 'obsidian';


import { MathSettings, MathContextSettings, DEFAULT_SETTINGS, MathContextSettingsHelper, findNearestAncestorContextSettings } from 'settings';
import { getLinksAndEmbedsInFile, increaseQuoteLevel, linktext2TFile, getCurrentMarkdown, getActiveTextView } from 'utils';
import { SmartCallout, autoIndexMathCallouts, insertMathCalloutCallback, resolveSettings } from 'smart_callouts';
import { ContextSettingModal, ExcludedFileManageModal, LocalContextSettingsSuggestModal, SmartCalloutModal } from 'modals';
import { insertDisplayMath, insertInlineMath } from 'key';
import { ExampleView, VIEW_TYPE_EXAMPLE } from 'views';
import { MathCalloutField } from 'editor_extensions';


export const VAULT_ROOT = '/';


class CMTest extends MarkdownRenderChild {
	onload(): void {
		this.containerEl.remove();
	}
}



export default class MathPlugin extends Plugin {
	settings: Record<string, MathContextSettings>;
	excludedFiles: string[];


	async onload() {

		await loadMathJax();

		// @ts-ignore
		if (!MathJax) {
			console.warn("MathJax was not defined despite loading it.");
			return;
		}

		// @ts-ignore
		console.log("MathJax is ", MathJax);

		this.addCommand({
			id: "link-text-test",
			name: "Link Text Test",
			callback: () => {
				// Let's parse this linktext!
				let linktext = "Smart Callouts#^b549cb"; 

				// decompose linktext into path (linkpath) and subpath
				let { path, subpath } = parseLinktext(linktext);
				console.log(`path = ${path}, subpath = ${subpath}`);
				// -> path = Smart Callouts, subpath = #^b549cb

				// If you want path (linkpath) only, use getLinkpath
				console.log(`path by getLinkpath = ${getLinkpath(linktext)}`);
				// -> path by getLinkpath = Smart Callouts

				// get TFile from path (linkpath)
				let file = this.app.metadataCache.getFirstLinkpathDest(path, "");
				console.log("TFile object: ", file);
				// -> TFile object:  t {parent: t, deleted: false, vault: t, path: 'Smart Callouts.md', name: 'Smart Callouts.md', …}

				if (file) {
					// prepare CachedMetadata of the file
					let cache = this.app.metadataCache.getFileCache(file);
					if (cache) {
						// get cached info from the subpath
						let subpathResult = resolveSubpath(cache, subpath);
						console.log("SubpathResult object: ", subpathResult);
						// -> SubpathResult object:  {type: 'block', block: {…}, list: {…}, start: {…}, end: {…}}
					}
					
					// generate linktext from a TFile object
					console.log(`generated linktext = ${this.app.metadataCache.fileToLinktext(file, "")}`);
					// -> generated linktext = Smart Callouts

					// actually open the link in Obsidian!
					this.app.workspace.openLinkText(linktext, "");
				}
			}
		});

		await this.loadSettings();

		this.addCommand({
			id: 'insert-inline-math',
			name: 'Insert Inline Math',
			editorCallback: insertInlineMath
		});

		this.addCommand({
			id: 'insert-display-math',
			name: 'Insert Display Math',
			editorCallback: insertDisplayMath
		});

		this.addCommand({
			id: 'insert-math-callout',
			name: 'Insert Math Callout',
			editorCallback: async (editor, context) => {
				let modal = new SmartCalloutModal(
					this.app,
					this,
					(config) => {
						insertMathCalloutCallback(this.app, editor, config);
					},
				);
				modal.resolveDefaultSettings(getCurrentMarkdown(this.app));
				modal.open();
			}
		});

		this.addCommand({
			id: 'open-local-settings-for-current-note',
			name: 'Open Local Settings for the Current Note',
			callback: () => {
				let currentFile = getCurrentMarkdown(this.app);
				if (currentFile) {
					let modal = new ContextSettingModal(this.app, this, currentFile.path);
					modal.resolveDefaultSettings(getCurrentMarkdown(this.app));
					modal.open();
				}
			}
		});

		this.addCommand({
			id: 'auto-index-math-callouts',
			name: 'Auto-index Math Callouts',
			editorCallback: (editor) => {
				let currentFile = getCurrentMarkdown(this.app);
				let cache = app.metadataCache.getFileCache(currentFile);
				if (cache) {
					autoIndexMathCallouts(cache, editor, currentFile, this);
				}
			}
		});

		this.registerEditorExtension(MathCalloutField);

		this.registerEvent(
			this.app.metadataCache.on(
				'changed',
				(file, data, cache) => {
					let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
					let editor = activeView?.editor;
					if (activeView && editor && file == activeView.file) {
						autoIndexMathCallouts(cache, editor, file, this);
					}
				}
			)
		);

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
							let smartCallout = new SmartCallout(callout, this.app, this, settings, currentFile);
							// smartCallout.resolveSettings(currentFile);
							// await smartCallout.renderTitle();
							context.addChild(smartCallout);
						}
					}
				}
			}
		});

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


export class MathSettingTab extends PluginSettingTab {
	constructor(app: App, public plugin: MathPlugin) {
		super(app, plugin);
	}

	addRestoreDefaultsBottun(key: string) {
		new Setting(this.containerEl)
			.addButton((btn) => {
				btn.setButtonText("Restore default");
				btn.onClick(async (event) => {
					Object.assign(this.plugin.settings[key], DEFAULT_SETTINGS);
					await this.plugin.saveSettings();
					this.display();
				})
			});
	}

	displayUnit(key: string) {
		let defaultSettings: MathContextSettings = {};
		// if (! (key in this.plugin.settings)) {
		let folder = this.app.vault.getAbstractFileByPath(key);
		if (folder) {
			let contextSettings = findNearestAncestorContextSettings(this.plugin, folder);
			defaultSettings = Object.assign({}, this.plugin.settings[VAULT_ROOT], contextSettings);
		}
		// }
		(new MathContextSettingsHelper(
			this.containerEl,
			this.plugin.settings[key],
			defaultSettings,
			// this.plugin.settings[key],
			this.plugin,
		)).makeSettingPane(true);
		this.addRestoreDefaultsBottun(key);
	}

	display() {
		let { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Global settings" });
		this.displayUnit(VAULT_ROOT);

		containerEl.createEl("h3", { text: "Local settings" });


		new Setting(containerEl).setName("Local settings")
			.setDesc("You can set up file-specific or folder-specific configurations, which have more precedence than the global settings.")
			.addButton((btn) => {
				btn.setButtonText("Search files & folders")
					.onClick((event) => {
						new LocalContextSettingsSuggestModal(this.app, this.plugin, this).open();
					});
			});


		new Setting(containerEl)
			.setName("Excluded files")
			.setDesc("You can make your search results more visible by excluding certain files or folders.")
			.addButton((btn) => {
				btn.setButtonText("Manage")
					.onClick((event) => {
						new ExcludedFileManageModal(this.app, this.plugin).open();
					});
			});
	}
}
