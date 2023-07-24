import { App, Modal, Setting, TextComponent, prepareFuzzySearch, prepareSimpleSearch, SuggestModal, Notice } from 'obsidian';

import { TheoremLikeEnv, getTheoremLikeEnv, ENVs } from 'env';
import LanguageManager from 'language';
import { MathSettings, MathContextSettings, MathItemSettings, MathItemSettingsHelper, MathContextSettingsHelper } from 'settings';


export class SmartCalloutModal extends Modal {
    smartCalloutConfig: MathSettings;

    constructor(app: App, public callback: (config: MathSettings) => void) {
        super(app);
        this.smartCalloutConfig = {} as MathSettings;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl('h4', { text: 'Item-specific settings' });

        const itemSettingsHelper = new MathItemSettingsHelper(contentEl, this.smartCalloutConfig);
        itemSettingsHelper.makeSettingPane();

        contentEl.createEl('h4', { text: 'Override context settings' });

        const contextSettingsHelper = new MathContextSettingsHelper(contentEl, this.smartCalloutConfig);
        contextSettingsHelper.makeSettingPane();

        new Setting(contentEl)
            .addButton((btn) => {
                // buttonContainer.appendChild(btn.buttonEl);
                btn
                    .setButtonText("Insert")
                    .setCta()
                    .onClick(() => {
                        this.checkIfComplete();
                        this.close();
                        this.callback(this.smartCalloutConfig);
                    });
                btn.buttonEl.classList.add("insert-math-item-button");
            });

        let button = contentEl.querySelector(".insert-math-item-button");
        let settingTextboxes = contentEl.querySelectorAll("input");
        console.log(button);
        if (button) {
            settingTextboxes.forEach((textbox) => {
                textbox.addEventListener("keypress", (event) => {
                    // event.preventDefault();
                    if (event.key === "Enter") {
                        // @ts-ignore
                        button.click();
                    }
                });
            });
        }


        // new Setting(contentEl)
        //     .addExtraButton((btn) => {
        //         // buttonContainer.appendChild(btn.buttonEl);
        //         btn
        //             // .setButtonText("Cancel")
        //             .onClick(() => {
        //                 this.close();
        //             });
        //     });

    }

    onClose(): void {
        this.contentEl.empty();
    }

    checkIfComplete(): void {
        this.smartCalloutConfig.type
    }
}


