import { ENVs, TheoremLikeEnv, getTheoremLikeEnv } from "env";
import MathPlugin from "main";
import { DEFAULT_LANG } from "default_lang";

import { App, Plugin, PluginSettingTab, Setting, TextComponent } from "obsidian";


export interface MathContextSettings {
    lang?: string;
    number_prefix?: string;
    number_suffix?: string;
    number_init?: number;
    label_prefix?: string;
    rename?: Record<string, string>;
}

export interface MathItemSettings {
    type: string;
    number?: string;
    title?: string;
    label?: string;
}

export interface MathItemPrivateFields {
    autoIndex?: number;
}


// export type MathMetadata = MathContextSettings & MathItemSettings;
export type MathSettings = MathContextSettings & MathItemSettings & MathItemPrivateFields;



export const MATH_CONTXT_SETTINGS_KEYS = [
    "lang",
    "number_prefix",
    "number_suffix",
    "number_init",
    "label_prefix",
    "rename",
]

export const MATH_ITEM_SETTINGS_KEYS = [
    "type",
    "number",
    "title",
    "label"
]

export const MATH_ITEM_PRIVATE_FIELDS_KEYS = [
    "autoIndex",
]


export const MATH_SETTINGS_KEYS = [
    ...MATH_CONTXT_SETTINGS_KEYS, 
    ...MATH_ITEM_SETTINGS_KEYS, 
    ...MATH_ITEM_PRIVATE_FIELDS_KEYS
]






export const DEFAULT_SETTINGS = {
    lang: DEFAULT_LANG,
    number_prefix: "",
    number_suffix: "",
    number_init: 0,
    label_prefix: "",
}




import LanguageManager from "language";




export class MathItemSettingsHelper {
    env: TheoremLikeEnv;
    constructor(public contentEl: HTMLElement, public settings: MathItemSettings) { }

    makeSettingPane() {
        const { contentEl } = this;


        new Setting(contentEl)
            .setName("type")
            .addDropdown((dropdown) => {
                for (let env of ENVs) {
                    dropdown.addOption(
                        env.id,
                        `${env.printedNames["ja"]}/${env.printedNames["en"]}`,
                    );
                }

                let initType = dropdown.getValue();
                this.settings.type = initType;
                this.env = getTheoremLikeEnv(initType);


                new Setting(contentEl)
                    .setName("number")
                    .addText((text) => {
                        text.setValue("auto");
                        this.settings.number = text.getValue();
                        text.onChange((value) => {
                            this.settings.title = value;
                        });
                    })


                let titleComp: TextComponent;
                let titlePane = new Setting(contentEl).setName("title")


                let labelPane = new Setting(contentEl).setName("label");
                let labelPrefixEl = labelPane.controlEl.createDiv({ text: this.env.prefix + ":" });

                titlePane.addText((text) => {
                    text.inputEl.setAttribute('style', 'width: 300px;')


                    let labelTextComp: TextComponent;
                    // let labelInputEl: HTMLElement;
                    labelPane.addText((text) => {
                        labelTextComp = text;
                        text.inputEl.setAttribute('style', 'width: 300px;')
                        text.onChange((value) => {
                            this.settings.label = value;
                        });

                    });

                    text
                        .setPlaceholder("e.g. Uniform law of large numbers")
                        .onChange((value) => {
                            this.settings.title = value;
                            labelTextComp.setValue(this.settings.title.replaceAll(' ', '-').replaceAll("'s", '').replaceAll("\\", "").replaceAll("$", "").toLowerCase());
                        })
                });

                dropdown.onChange((value) => {
                    this.settings.type = value;
                    this.env = getTheoremLikeEnv(value);
                    labelPrefixEl.textContent = this.env.prefix + ":";
                    // textComponent.setValue(this.settings.title.replaceAll(' ', '-').toLowerCase());
                });


            });

    }
}



export class MathContextSettingsHelper {
    constructor(
        public contentEl: HTMLElement,
        public settings: MathContextSettings,
        public plugin?: MathPlugin, // passed if called from the plugin's setting tab
    ) { }


    addTextSetting(name: keyof MathContextSettings, defaultValue?: string): Setting {
        let callback: (value: string) => void | Promise<void>;
        if (this.plugin) {
            defaultValue = String(this.settings[name]);
            callback = async (value: string): Promise<void> => {
                this.settings[name] = value;
                await this.plugin?.saveSettings();
            };
        } else {
            callback = (value: string): void => {
                this.settings[name] = value;
            };
        }
        return new Setting(this.contentEl)
            .setName(name)
            .addText((text) => {
                if (defaultValue) {
                    text.setValue(defaultValue);
                }
                text.onChange(callback)
            });
    }


    makeSettingPane() {
        const { contentEl } = this;

        new Setting(contentEl)
            .setName("lang")
            .addDropdown((dropdown) => {
                for (let lang of LanguageManager.supported) {
                    dropdown.addOption(lang, lang);
                }
                dropdown.onChange((value) => {
                    this.settings.lang = value;
                });
            });
        this.addTextSetting("number_prefix");
        this.addTextSetting("number_suffix");
        this.addTextSetting("number_init");
        this.addTextSetting("label_prefix");
    }
}

