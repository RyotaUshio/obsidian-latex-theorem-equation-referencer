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
} from 'obsidian';
// import { parse, stringify } from 'yaml';


import { MathSettings, MathContextSettings, DEFAULT_SETTINGS, MathContextSettingsHelper } from 'settings';
import { getLinksAndEmbedsInFile, increaseQuoteLevel, linktext2TFile, getCurrentMarkdown } from 'utils';
import { SmartCallout, autoIndexMathCallouts, insertMathCalloutCallback } from 'smart_callouts';
import { SmartCalloutModal } from 'modals';
import { insertDisplayMath, insertInlineMath } from 'key';




export default class MathPlugin extends Plugin {
	settings: MathContextSettings;


	async indexSmartCallouts() {
		let markdownFiles = this.app.vault.getMarkdownFiles();
		for (let markdownFile of markdownFiles) {
			let content = this.app.vault.cachedRead(markdownFile);

		}
	}


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

		this.register




		this.addCommand({
			id: "change-mode",
			name: "Change mode",
			callback: () => {
				console.log(this.app);
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				console.log("BEGIN!");
				console.log(view.currentMode);
				console.log(view.previewMode);
				console.log(view.getMode());
				console.log(view.getViewData());
				console.log(view?.showSearch());
				console.log("END!");
			},
		});







		this.addCommand({
			id: 'insert-math-callout',
			name: 'Insert math callout',
			editorCallback: (editor, context) => {
				new SmartCalloutModal(
					this.app,
					(config) => insertMathCalloutCallback(editor, config),
				).open();
			}
		});


		this.addCommand({
			id: 'auto-index-math-callouts',
			name: 'Auto-index math callouts',
			editorCallback: (editor) => {
				autoIndexMathCallouts(this.app, editor);
			}
		});


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

							let smartCallout = new SmartCallout(callout, settings, this);
							await smartCallout.renderTitle();
							context.addChild(smartCallout);


						// const calloutTitleInner = callout.querySelector<HTMLElement>('.callout-title-inner');
						// if (calloutTitleInner) {
						// 	let smartCalloutTitleInner = new SmartCallout(callout, settings, this);
						// 	await smartCalloutTitleInner.renderTitle();
						// 	context.addChild(smartCalloutTitleInner);
						// }

						// const calloutContent = callout.querySelector<HTMLElement>('.callout-content');
						// if (calloutContent) {
						// 	context.addChild();
						// }
					}
				}

			}
		});




		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				menu.addItem((item) => {
					item.setTitle("Edit math settings")
						.setIcon("document")
						.onClick(async () => {
							new Notice("I WANNA EDIT!");
						});
				});
			})
		);



		// let body = this.app.vault.getAbstractFileByPath('Body.md');

		// let links;
		// let files;
		// if (body instanceof TFile) {
		// 	let res = getLinksAndEmbedsInFile(this.app, body);
		// 	if (res.links && res.embeds) {
		// 		links = res.links.concat(res.embeds);
		// 		files = links.map(
		// 			(link) => linktext2TFile(this.app, link)
		// 		);
		// 		files.forEach(file => {
		// 			let note = new TheoremNote(this.app, file);

		// 		});
		// 	}

		// }
		// console.log(links);

		// this.addCommand({
		// 	id: 'test-command',
		// 	name: 'Test command',
		// 	callback: async () => {
		// 		let note = new TheoremNote(this.app);
		// 		await note.getMetadata();
		// 		note.getOffset();
		// 	}
		// });

		this.addSettingTab(new MathSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}





export class MathSettingTab extends PluginSettingTab {
	constructor(app: App, public plugin: MathPlugin) {
		super(app, plugin);
	}

	display() {
		let { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Context settings" });
		(new MathContextSettingsHelper(containerEl, this.plugin.settings, this.plugin)).makeSettingPane();

	}

}