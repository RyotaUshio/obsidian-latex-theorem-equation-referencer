import { MathContextSettings } from 'theorem_note';
import { MathPlugin } from 'main';
import { App, Modal, Setting, TextComponent, prepareFuzzySearch, prepareSimpleSearch, SuggestModal, Notice } from 'obsidian';

import { TheoremLikeEnv, getTheoremLikeEnv, ENVs } from 'env';
import LanguageManager from 'language';
import { MathSettings, MathContextSettings, MathItemSettings, MathItemSettingsHelper, MathContextSettingsHelper, MATH_CONTXT_SETTINGS_KEYS } from 'settings';
import { getCurrentMarkdown } from 'utils';



abstract class MathSettingModal<SettingsType> extends Modal {
    settings: SettingsType;
    defaultSettings: MathContextSettings; // this is different from DEFAULT_SETTINGS
    // this.default.Settings determines what is preset in the input elements in the modal

    constructor(app: App, public plugin: MathPlugin, public callback: (settings: SettingsType) => void) {
        super(app);
        this.settings = {} as SettingsType;
        this.defaultSettings = {} as MathContextSettings;
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async resolveDefaultSettings() {
        await this.app.fileManager.processFrontMatter(
            getCurrentMarkdown(this.app),
            (frontmatter) => {
                Object.assign(this.defaultSettings, this.plugin.settings, frontmatter.math);
            }
        )
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
        const itemSettingsHelper = new MathItemSettingsHelper(contentEl, this.settings);
        itemSettingsHelper.makeSettingPane();

        contentEl.createEl('h4', { text: 'Override context settings' });
        const contextSettingsHelper = new MathContextSettingsHelper(contentEl, this.settings, this.defaultSettings);
        contextSettingsHelper.makeSettingPane();

        this.addButton('insert');
    }
}



export class ContextSettingModal extends MathSettingModal<MathContextSettings> {
    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl('h4', { text: 'Local context settings' });
        const contextSettingsHelper = new MathContextSettingsHelper(contentEl, this.settings, this.defaultSettings);
        contextSettingsHelper.makeSettingPane();

        this.addButton('Confirm');
    }
}


