import { MarkdownView, TAbstractFile, TFile, App, Modal, Setting, FuzzySuggestModal, TFolder } from 'obsidian';

import MathBooster from './main';
import { MathSettings, MathContextSettings } from './settings/settings';
import { MathSettingTab } from "./settings/tab";
import { MathCalloutSettingsHelper, MathContextSettingsHelper } from "./settings/helper";
import { isEqualToOrChildOf, findNearestAncestorContextSettings } from './utils';


abstract class MathSettingModal<SettingsType> extends Modal {
    settings: SettingsType;
    defaultSettings: Partial<MathSettings>; // this is different from DEFAULT_SETTINGS
    // this.default.Settings determines what is preset in the input elements in the modal

    constructor(
        app: App,
        public plugin: MathBooster,
        public callback?: (settings: SettingsType) => void,
        public currentCalloutSettings?: MathSettings,
    ) {
        super(app);
        this.defaultSettings = {} as Partial<MathSettings>;
    }

    onClose(): void {
        this.contentEl.empty();
    }

    resolveDefaultSettings(currentFile: TAbstractFile) {
        let contextSettings = findNearestAncestorContextSettings(this.plugin, currentFile)
        Object.assign(this.defaultSettings, contextSettings);
        if (this.currentCalloutSettings) {
            Object.assign(this.defaultSettings, this.currentCalloutSettings);
        }
    }

    addButton(buttonText: string) {
        const { contentEl } = this;
        new Setting(contentEl)
            .addButton((btn) => {
                btn
                    .setButtonText(buttonText)
                    .setCta()
                    .onClick(() => {
                        this.close();
                        if (this.callback) {
                            this.callback(this.settings);
                        }
                    });
                btn.buttonEl.classList.add("insert-math-item-button");
            });

        let button = contentEl.querySelector(".insert-math-item-button");
        let settingTextboxes = contentEl.querySelectorAll("input");
        if (button) {
            settingTextboxes.forEach((textbox) => {
                textbox.addEventListener("keypress", (event) => {
                    if (event.key === "Enter") {
                        (button as HTMLElement).click();
                    }
                });
            });
        }
    }
}


export class MathCalloutModal extends MathSettingModal<MathSettings> {
    constructor(
        app: App,
        plugin: MathBooster,
        public view: MarkdownView,
        callback: (settings: MathSettings) => void,
        public buttonText: string,
        public headerText: string, 
        currentCalloutSettings?: MathSettings,
    ) {
        super(app, plugin, callback, currentCalloutSettings);
    }


    onOpen(): void {
        this.settings = this.currentCalloutSettings ?? {} as MathSettings;
        const { contentEl } = this;

        if (this.headerText) {
            contentEl.createEl("h4", {text: this.headerText});
        }

        const itemSettingsHelper = new MathCalloutSettingsHelper(contentEl, this.settings, this.defaultSettings);
        itemSettingsHelper.makeSettingPane();

        new Setting(contentEl)
            .setName('Open local settings for the current note')
            .addButton((button) => {
                button.setButtonText("Open")
                    .onClick((event) => {
                        let modal = new ContextSettingModal(
                            this.app,
                            this.plugin, 
                            this.view.file.path, 
                            undefined, 
                        );
                        modal.resolveDefaultSettings(this.view.file);
                        modal.open();
                    })
            });

        this.addButton(this.buttonText);
    }
}


export class ContextSettingModal extends MathSettingModal<MathContextSettings> {

    constructor(
        app: App, 
        plugin: MathBooster, 
        public path: string, 
        callback?: (settings: MathContextSettings) => void, 
    ) {
        super(app, plugin, callback);
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl
            .createEl('h3', { text: 'Local settings for ' + this.path });

        if (this.plugin.settings[this.path] === undefined) {
            this.plugin.settings[this.path] = {} as MathContextSettings;
        }
        const contextSettingsHelper = new MathContextSettingsHelper(contentEl, this.plugin.settings[this.path], this.defaultSettings, this.plugin);
        contextSettingsHelper.makeSettingPane();
        this.addButton('Save');
    }
}


abstract class FileSuggestModal extends FuzzySuggestModal<TAbstractFile> {

    constructor(app: App, public plugin: MathBooster) {
        super(app);
    }

    getItems(): TAbstractFile[] {
        return this.app.vault
            .getAllLoadedFiles()
            .filter(this.filterCallback.bind(this));
        // https://javascript.info/bind
        // https://stackoverflow.com/a/59060545/13613783
    }

    getItemText(file: TAbstractFile): string {
        return file.path;
    }

    filterCallback(abstractFile: TAbstractFile): boolean {
        if (abstractFile instanceof TFile && abstractFile.extension != 'md') {
            return false;
        }
        if (abstractFile instanceof TFolder && abstractFile.isRoot()) {
            return false;
        }
        for (let path of this.plugin.excludedFiles) {
            let file = this.app.vault.getAbstractFileByPath(path)
            if (file && isEqualToOrChildOf(abstractFile, file)) {
                return false
            }
        }
        return true;
    }
}



export class LocalContextSettingsSuggestModal extends FileSuggestModal {
    constructor(app: App, plugin: MathBooster, public settingTab: MathSettingTab) {
        super(app, plugin);
    }

    onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
        let modal = new ContextSettingModal(this.app, this.plugin, file.path);
        modal.resolveDefaultSettings(file);
        modal.open();
    }
}



export class FileExcludeSuggestModal extends FileSuggestModal {
    constructor(app: App, plugin: MathBooster, public manageModal: ExcludedFileManageModal) {
        super(app, plugin);
    }

    onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
        this.plugin.excludedFiles.push(file.path);
        this.manageModal.newDisplay();
    }

    filterCallback(abstractFile: TAbstractFile): boolean {
        for (let path in this.plugin.settings) {
            if (path == abstractFile.path) {
                return false;
            }
        }
        return super.filterCallback(abstractFile);
    }
}


export class ExcludedFileManageModal extends Modal {
    constructor(app: App, public plugin: MathBooster) {
        super(app);
    }

    onOpen() {
        this.newDisplay();
    }

    async newDisplay() {
        await this.plugin.saveSettings();
        let { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Excluded files/folders' });

        let addButtonContainer = new Setting(contentEl)
            .setName('The files/folders in this list and their descendants will be excluded from suggestion for local settings.')
            .addButton((btn) => {
                btn.setIcon("plus")
                    .onClick((event) => {
                        new FileExcludeSuggestModal(this.app, this.plugin, this).open();
                    });
            });

        // let saveButtonContainer = new Setting(contentEl)
        //     .addButton((btn) => {
        //         btn.setButtonText("Save")
        //             .onClick(async (event) => {
        //                 await this.plugin.saveSettings();
        //                 this.close();
        //             });
        //     });

        // let addButtonEl = addButtonContainer.controlEl.querySelector<HTMLElement>('button');
        // let saveButtonEl = saveButtonContainer.controlEl.querySelector<HTMLElement>('button');
        // if (addButtonEl && saveButtonEl) {
        //     addButtonContainer.controlEl.replaceChildren(
        //         addButtonEl, saveButtonEl
        //     )
        // }
        // contentEl.removeChild(saveButtonContainer.settingEl);

        if (this.plugin.excludedFiles.length) {
            let list = contentEl.createEl('ul');
            for (let path of this.plugin.excludedFiles) {
                let item = list.createEl('li').createDiv();
                new Setting(item).setName(path).addExtraButton((btn) => {
                    btn.setIcon('x').onClick(async () => {
                        this.plugin.excludedFiles.remove(path);
                        this.newDisplay();
                        await this.plugin.saveSettings();
                    });
                });
            }
        }

    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

