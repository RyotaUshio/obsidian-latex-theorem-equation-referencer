import { Plugin } from 'obsidian';
import MathPlugin, { MathSettingTab, VAULT_ROOT } from 'main';
import { App, Modal, Setting, TextComponent, prepareFuzzySearch, prepareSimpleSearch, SuggestModal, Notice, FuzzySuggestModal, TFolder } from 'obsidian';

import { TheoremLikeEnv, getTheoremLikeEnv, ENVs } from 'env';
import LanguageManager from 'language';
import { MathSettings, MathContextSettings, MathItemSettings, MathItemSettingsHelper, MathContextSettingsHelper, MATH_CONTXT_SETTINGS_KEYS, CalloutSettings, findNearestAncestorContextSettings } from 'settings';
import { getCurrentMarkdown, isChildOf, isEqualToOrChildOf } from 'utils';



abstract class MathSettingModal<SettingsType> extends Modal {
    settings: SettingsType;
    defaultSettings: Partial<MathSettings>; // this is different from DEFAULT_SETTINGS
    // this.default.Settings determines what is preset in the input elements in the modal

    constructor(
        app: App,
        public plugin: MathPlugin,
        public callback: (settings: SettingsType) => void,
        public currentCalloutSettings?: CalloutSettings,
    ) {
        super(app);
        this.settings = {} as SettingsType;
        this.defaultSettings = {} as Partial<MathSettings>;
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async resolveDefaultSettings() {
        let currentFile = getCurrentMarkdown(this.app);
        let folderContextSettings = findNearestAncestorContextSettings(this.plugin, currentFile)
        console.log("folderContextSettings: ", folderContextSettings);
        console.log("this.plugin.settings[VAULT_ROOT]: ", this.plugin.settings[VAULT_ROOT]);
        console.log("this.plugin.settings: ", this.plugin.settings);
        await this.app.fileManager.processFrontMatter(
            currentFile,
            (frontmatter) => {
                Object.assign(this.defaultSettings, this.plugin.settings[VAULT_ROOT], folderContextSettings, frontmatter.math);
            }
        )
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
                        this.callback(this.settings);
                    });
                btn.buttonEl.classList.add("insert-math-item-button");
            });

        let button = contentEl.querySelector(".insert-math-item-button");
        let settingTextboxes = contentEl.querySelectorAll("input");
        if (button) {
            settingTextboxes.forEach((textbox) => {
                textbox.addEventListener("keypress", (event) => {
                    if (event.key === "Enter") {
                        // @ts-ignore
                        button.click();
                    }
                });
            });
        }
    }
}


export class SmartCalloutModal extends MathSettingModal<MathSettings> {


    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl('h4', { text: 'Item-specific settings' });
        const itemSettingsHelper = new MathItemSettingsHelper(contentEl, this.settings, this.defaultSettings);
        itemSettingsHelper.makeSettingPane();

        contentEl.createEl('h4', { text: 'Override context settings' });
        const contextSettingsHelper = new MathContextSettingsHelper(contentEl, this.settings, this.defaultSettings);
        contextSettingsHelper.makeSettingPane(false);

        this.addButton('Confirm');
    }
}



export class ContextSettingModal extends MathSettingModal<MathContextSettings> {
    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl('h4', { text: 'Local context settings' });
        const contextSettingsHelper = new MathContextSettingsHelper(contentEl, this.settings, this.defaultSettings);
        contextSettingsHelper.makeSettingPane(true);

        this.addButton('Confirm');
    }
}




abstract class FolderSuggestModal extends FuzzySuggestModal<TFolder> {

    constructor(app: App, public plugin: MathPlugin) {
        super(app);
    }

    getItems(): TFolder[] {
        return this.app.vault
            .getAllLoadedFiles()
            .filter((abstractFile) => {
                if (!(abstractFile instanceof TFolder)) {
                    return false;
                }
                if (abstractFile.isRoot()) {
                    return false;
                }
                for (let folderPath of this.plugin.excludedFolders) {
                    let folder = this.app.vault.getAbstractFileByPath(folderPath)
                    if (folder instanceof TFolder && isEqualToOrChildOf(abstractFile, folder)) {
                        return false
                    }
                }
                for (let folderPath in this.plugin.settings) {
                    if (folderPath == abstractFile.path) {
                        return false;
                    }
                }
                return true;
            }) as TFolder[];
    }

    getItemText(folder: TFolder): string {
        return folder.path;
    }
}



export class FolderContextSettingsSuggestModal extends FolderSuggestModal {

    constructor(app: App, plugin: MathPlugin, public settingTab: MathSettingTab) {
        super(app, plugin);
    }

    onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
        let { containerEl } = this.settingTab;
        containerEl.empty();
        containerEl.createEl("h3", { text: "Local settings for " + folder.path });
        this.settingTab.displayUnit(folder.path);
    }
}


export class FolderExcludeSuggestModal extends FolderSuggestModal {
    constructor(app: App, plugin: MathPlugin, public manageModal: ExcludedFolderManageModal) {
        super(app, plugin);
    }

    onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
        this.plugin.excludedFolders.push(folder.path);
        this.manageModal.newDisplay();
    }
}


export class ExcludedFolderManageModal extends Modal {
    constructor(app: App, public plugin: MathPlugin) {
        super(app);
    }

    onOpen() {
        this.newDisplay();
    }

    async newDisplay() {
        await this.plugin.saveSettings();
        let { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Excluded folders' });
        // contentEl.createEl('p', { text: 'The folders in this list and their descendants will be excluded from suggestion for folder context settings.' });

        let addButtonContainer = new Setting(contentEl)
            .setName('The folders in this list and their descendants will be excluded from suggestion for folder context settings.')
            .addButton((btn) => {
                btn.setIcon("plus")
                    .onClick((event) => {
                        new FolderExcludeSuggestModal(this.app, this.plugin, this).open();
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

        if (this.plugin.excludedFolders.length) {
            let list = contentEl.createEl('ul');
            for (let folderPath of this.plugin.excludedFolders) {
                let item = list.createEl('li').createDiv();
                new Setting(item).setName(folderPath).addExtraButton((btn) => {
                    btn.setIcon('x').onClick(async () => {
                        this.plugin.excludedFolders.remove(folderPath);
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

