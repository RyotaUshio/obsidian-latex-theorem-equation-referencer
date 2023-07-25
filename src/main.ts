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
} from 'obsidian';
// import { parse, stringify } from 'yaml';


import { MathSettings, MathContextSettings, DEFAULT_SETTINGS, MathContextSettingsHelper, findNearestAncestorContextSettings } from 'settings';
import { getLinksAndEmbedsInFile, increaseQuoteLevel, linktext2TFile, getCurrentMarkdown } from 'utils';
import { SmartCallout, autoIndexMathCallouts, insertMathCalloutCallback } from 'smart_callouts';
import { ContextSettingModal, ExcludedFileManageModal, LocalContextSettingsSuggestModal, FolderExcludeSuggestModal, FolderSuggestModal, SmartCalloutModal, folderContextSettingsSuggestModal, folderExcludeSuggestModal, addRestoreDefaultsBottun } from 'modals';
import { insertDisplayMath, insertInlineMath } from 'key';



export const VAULT_ROOT = '/';



export default class MathPlugin extends Plugin {
	settings: Record<string, MathContextSettings>;
	excludedFiles: string[];


	// async indexSmartCallouts() {
	// 	let markdownFiles = this.app.vault.getMarkdownFiles();
	// 	for (let markdownFile of markdownFiles) {
	// 		let content = this.app.vault.cachedRead(markdownFile);
	// 	}
	// }

	async onload() {

		await loadMathJax();

		// @ts-ignore
		if (!MathJax) {
			console.warn("MathJax was not defined despite loading it.");
			return;
		}

		// @ts-ignore
		console.log("MathJax is ", MathJax);


		await this.loadSettings();



		this.addCommand({
			id: 'insert-inline-math',
			name: 'Insert inline math',
			editorCallback: insertInlineMath
		});

		this.addCommand({
			id: 'insert-display-math',
			name: 'Insert display math',
			editorCallback: insertDisplayMath
		});





		this.addCommand({
			id: 'insert-math-callout',
			name: 'Insert math callout',
			editorCallback: async (editor, context) => {
				let modal = new SmartCalloutModal(
					this.app,
					this,
					(config) => {
						insertMathCalloutCallback(editor, config);
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
			name: 'Auto-index math callouts',
			editorCallback: (editor) => {
				let currentFile = getCurrentMarkdown(this.app);
				let cache = app.metadataCache.getFileCache(currentFile);
				if (cache) {
					autoIndexMathCallouts(cache, editor);
				}
			}
		});


		this.registerEvent(
			this.app.metadataCache.on(
				'changed',
				(file, data, cache) => {
					let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
					let editor = activeView?.editor;
					if (activeView && editor && file == activeView.file) {
						autoIndexMathCallouts(cache, editor);
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
						console.log("sourcePath: ", context.sourcePath);
						const settings = JSON.parse(metadata);

						let smartCallout = new SmartCallout(callout, this.app, this, settings);
						let currentFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
						if (currentFile instanceof TFile) {
							await smartCallout.resolveSettings(currentFile);
							await smartCallout.renderTitle();
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
		console.log("loadedData: ", loadedData);
		if (loadedData) {
			console.log("loadedData:", loadedData);
			let {settings, excludedFiles} = loadedData;
			this.settings = Object.assign({}, {[VAULT_ROOT]: DEFAULT_SETTINGS}, settings);
			this.excludedFiles = excludedFiles;	
		} else {
			this.settings = Object.assign({}, {[VAULT_ROOT]: DEFAULT_SETTINGS}, undefined);
			this.excludedFiles = [];	
		}
	}

	async saveSettings() {
		console.log("BEFORE SAVE", this.settings);
		await this.saveData({settings: this.settings, excludedFiles: this.excludedFiles});
	}

}





export class MathSettingTab extends PluginSettingTab {
	constructor(app: App, public plugin: MathPlugin) {
		super(app, plugin);
	}


	addRestoreDefaultsBottun (key: string) {
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








///////////////////////




// import {
// 	App,
// 	Editor,
// 	MarkdownView,
// 	Modal,
// 	Notice,
// 	Plugin,
// 	PluginSettingTab,
// 	Setting,
// 	parseLinktext,
// 	MetadataCache,
// 	FileSystemAdapter,
// 	getLinkpath,
// 	TFile,
// 	LinkCache,
// 	MarkdownRenderChild,
// 	loadMathJax,
// 	renderMath,
// 	finishRenderMath,
// 	FuzzySuggestModal,
// } from 'obsidian';
// // import { parse, stringify } from 'yaml';


// import { MathSettings, MathContextSettings, DEFAULT_SETTINGS, MathContextSettingsHelper } from 'settings';
// import { getLinksAndEmbedsInFile, increaseQuoteLevel, linktext2TFile, getCurrentMarkdown } from 'utils';
// import { SmartCallout, autoIndexMathCallouts, autoIndexNewMathCallouts, insertMathCalloutCallback } from 'smart_callouts';
// import { ContextSettingModal, SmartCalloutModal } from 'modals';
// import { insertDisplayMath, insertInlineMath } from 'key';




// export default class MathPlugin extends Plugin {
// 	settings: MathContextSettings;


// 	async indexSmartCallouts() {
// 		let markdownFiles = this.app.vault.getMarkdownFiles();
// 		for (let markdownFile of markdownFiles) {
// 			let content = this.app.vault.cachedRead(markdownFile);

// 		}
// 	}


// 	async onload() {

// 		await loadMathJax();

// 		// @ts-ignore
// 		if (!MathJax) {
// 			console.warn("MathJax was not defined despite loading it.");
// 			return;
// 		}

// 		// @ts-ignore
// 		console.log("MathJax is ", MathJax);


// 		await this.loadSettings();



// 		this.addCommand({
// 			id: 'insert-inline-math',
// 			name: 'Insert inline math',
// 			editorCallback: insertInlineMath
// 		});

// 		this.addCommand({
// 			id: 'insert-display-math',
// 			name: 'Insert display math',
// 			editorCallback: insertDisplayMath
// 		});






// 		this.addCommand({
// 			id: "change-mode",
// 			name: "Change mode",
// 			callback: () => {
// 				console.log(this.app);
// 				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
// 				console.log("BEGIN!");
// 				console.log(view.currentMode);
// 				console.log(view.previewMode);
// 				console.log(view.getMode());
// 				console.log(view.getViewData());
// 				console.log(view?.showSearch());
// 				console.log("END!");
// 			},
// 		});







// 		this.addCommand({
// 			id: 'insert-math-callout',
// 			name: 'Insert math callout',
// 			editorCallback: async (editor, context) => {
// 				let modal = new SmartCalloutModal(
// 					this.app,
// 					this,
// 					(config) => {
// 						insertMathCalloutCallback(editor, config);
// 					},
// 					{}
// 				);
// 				await modal.resolveDefaultSettings();
// 				modal.open();
// 			}
// 		});



// 		this.addCommand({
// 			id: 'open-note-level-settings',
// 			name: 'Open note-level settings',
// 			callback: async () => {
// 				let modal = new ContextSettingModal(
// 					this.app,
// 					this,
// 					(settings) => {
// 						this.app.fileManager.processFrontMatter(
// 							getCurrentMarkdown(this.app),
// 							(frontmatter) => {
// 								if (!frontmatter.math) {
// 									frontmatter["math"] = {};
// 								}
// 								Object.assign(frontmatter.math, settings);
// 							}
// 						)
// 					}
// 				);
// 				await modal.resolveDefaultSettings();
// 				modal.open();
// 			}
// 		});


// 		this.addCommand({
// 			id: 'auto-index-math-callouts',
// 			name: 'Auto-index math callouts',
// 			editorCallback: (editor) => {
// 				let currentFile = getCurrentMarkdown(this.app);
// 				let cache = app.metadataCache.getFileCache(currentFile);
// 				if (cache) {
// 					autoIndexMathCallouts(cache, editor);
// 				}
// 			}
// 		});


// 		this.registerEvent(
// 			this.app.metadataCache.on(
// 				'changed',
// 				(file, data, cache) => {
// 					let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
// 					let editor = activeView?.editor;
// 					if (activeView && editor && file == activeView.file) {
// 						autoIndexMathCallouts(cache, editor);
// 					}
// 				}
// 			)
// 		);


// 		this.registerMarkdownPostProcessor(async (element, context) => {
// 			const callouts = element.querySelectorAll<HTMLElement>(".callout");

// 			for (let index = 0; index < callouts.length; index++) {
// 				let callout = callouts[index];

// 				let type = callout.getAttribute('data-callout');
// 				let metadata = callout.getAttribute('data-callout-metadata');
// 				if (metadata) {
// 					const isSmartCallout = (type?.toLowerCase() == 'math');

// 					if (isSmartCallout) {
// 						console.log("sourcePath: ", context.sourcePath);
// 						const settings = JSON.parse(metadata);

// 						let smartCallout = new SmartCallout(callout, this.app, this, settings);
// 						let currentFile = this.app.vault.getAbstractFileByPath(context.sourcePath);
// 						if (currentFile instanceof TFile) {
// 							await smartCallout.resolveSettings(currentFile);
// 							await smartCallout.renderTitle();
// 							context.addChild(smartCallout);
// 						}
// 					}
// 				}
// 			}
// 		});



// 		this.registerEvent(
// 			this.app.workspace.on("editor-menu", (menu, editor, view) => {
// 				console.log("MENU: ", menu);
// 				console.log("EDITOR: ", editor);
// 				console.log("VIEW: ", view);
// 				menu.addItem((item) => {
// 					item.setTitle("Edit math settings")
// 						.setIcon("document")
// 						.onClick(async () => {
// 							new Notice("I WANNA EDIT!");
// 						});
// 				});
// 			})
// 		);



// 		// let body = this.app.vault.getAbstractFileByPath('Body.md');

// 		// let links;
// 		// let files;
// 		// if (body instanceof TFile) {
// 		// 	let res = getLinksAndEmbedsInFile(this.app, body);
// 		// 	if (res.links && res.embeds) {
// 		// 		links = res.links.concat(res.embeds);
// 		// 		files = links.map(
// 		// 			(link) => linktext2TFile(this.app, link)
// 		// 		);
// 		// 		files.forEach(file => {
// 		// 			let note = new TheoremNote(this.app, file);

// 		// 		});
// 		// 	}

// 		// }
// 		// console.log(links);

// 		// this.addCommand({
// 		// 	id: 'test-command',
// 		// 	name: 'Test command',
// 		// 	callback: async () => {
// 		// 		let note = new TheoremNote(this.app);
// 		// 		await note.getMetadata();
// 		// 		note.getOffset();
// 		// 	}
// 		// });

// 		this.addSettingTab(new MathSettingTab(this.app, this));
// 	}

// 	onunload() {

// 	}

// 	async loadSettings() {
// 		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
// 	}

// 	async saveSettings() {
// 		await this.saveData(this.settings);
// 	}

// }





// export class MathSettingTab extends PluginSettingTab {
// 	constructor(app: App, public plugin: MathPlugin) {
// 		super(app, plugin);
// 	}

// 	display() {
// 		let { containerEl } = this;
// 		containerEl.empty();

// 		containerEl.createEl("h3", { text: "Global context settings" });
// 		(new MathContextSettingsHelper(
// 			containerEl,
// 			this.plugin.settings,
// 			this.plugin.settings,
// 			this.plugin
// 		)).makeSettingPane();

// 		new Setting(containerEl)
// 			.addButton((btn) => {
// 				btn.setButtonText("Restore default");
// 				btn.onClick((event) => {
// 					Object.assign(this.plugin.settings, DEFAULT_SETTINGS);
// 					this.plugin.saveSettings();
// 					this.display();
// 				})
// 			});

// 		containerEl.createEl("h3", { text: "Folder-local context settings" });
// 		// new Setting(containerEl)
// 		// 	.addButton((btn) => {
// 		// 		btn
// 		// 		.setButtonText("Add")
// 		// 		.setCta()
// 		// 		.onClick((event) => {
					
// 		// 		})
// 		// 	});
		

// 	}

// }