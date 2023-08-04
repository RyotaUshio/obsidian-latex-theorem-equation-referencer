import { Setting, TAbstractFile, TextComponent } from "obsidian";

import { ENV_IDs, ENVs, TheoremLikeEnv, getTheoremLikeEnv } from "env";
import MathPlugin, { VAULT_ROOT } from "main";
import { DEFAULT_LANG } from "default_lang";
import LanguageManager from "language";

export type NumberStyle = "arabic" | "alph" | "Alph" | "roman" | "Roman";

export type RenameEnv = { [K in typeof ENV_IDs[number]]: string };

export interface MathContextSettings {
    lang?: string;
    number_prefix?: string;
    number_suffix?: string;
    number_init?: number;
    number_style?: NumberStyle;
    eq_number_style?: NumberStyle;
    label_prefix?: string;
    rename?: RenameEnv;
    preamblePath?: string;
    lineByLine?: boolean;
}

export interface MathItemSettings {
    type: string;
    number?: string;
    title?: string;
    label?: string;
    mathLink?: string;
}

export interface MathItemPrivateFields {
    autoIndex?: number;
}

export type MathSettings = MathContextSettings & MathItemSettings & MathItemPrivateFields;
export type CalloutSettings = MathSettings;

export const MATH_CONTXT_SETTINGS_KEYS = [
    "lang",
    "number_prefix",
    "number_suffix",
    "number_init",
    "number_style", 
    "eq_number_style", 
    "label_prefix",
    "rename",
    "preamblePath",
    "lineByLine",
]

export const MATH_ITEM_SETTINGS_KEYS = [
    "type",
    "number",
    "title",
    "label",
    "mathLink",
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
    number_init: 1,
    number_style: "arabic", 
    eq_number_style: "arabic", 
    label_prefix: "",
    rename: {} as RenameEnv,
    preamblePath: "",
    lineByLine: true,
}


export class MathItemSettingsHelper {
    env: TheoremLikeEnv;
    constructor(
        public contentEl: HTMLElement,
        public settings: MathItemSettings,
        public defaultSettings: Partial<MathItemSettings>,
    ) { }

    makeSettingPane() {
        const { contentEl } = this;
        new Setting(contentEl)
            .setName("Type")
            .addDropdown((dropdown) => {
                for (let env of ENVs) {
                    dropdown.addOption(env.id, env.id);
                    if (this.defaultSettings.type) {
                        dropdown.setValue(String(this.defaultSettings.type));
                    }
                }

                let initType = dropdown.getValue();
                this.settings.type = initType;
                this.env = getTheoremLikeEnv(initType);

                let numberSetting = new Setting(contentEl)
                    .setName("Number")
                    .setDesc("Allowed values:");
                let numberSettingDescList = numberSetting.descEl.createEl("ul");
                numberSettingDescList.createEl(
                    "li",
                    { text: '"auto" - automatically numbered' }
                );
                numberSettingDescList.createEl(
                    "li",
                    { text: "(blank) - unnumbered" }
                );
                numberSettingDescList.createEl(
                    "li",
                    { text: "otherwise - used as is" }
                );

                numberSetting.addText((text) => {
                    text.setValue(
                        this.defaultSettings.number ?? "auto"
                    );
                    this.settings.number = text.getValue();
                    text.onChange((value) => {
                        this.settings.number = value;
                    });
                })

                let titleComp: TextComponent;
                let titlePane = new Setting(contentEl)
                    .setName("Title")
                    .setDesc("You may use inline math");


                let labelPane = new Setting(contentEl).setName("LaTeX Label");
                let labelPrefixEl = labelPane.controlEl.createDiv({ text: this.env.prefix + ":" });

                titlePane.addText((text) => {
                    text.inputEl.setAttribute('style', 'width: 300px;')
                    if (this.defaultSettings.title) {
                        text.setValue(this.defaultSettings.title);
                    }

                    let labelTextComp: TextComponent;
                    labelPane.addText((text) => {
                        labelTextComp = text;
                        text.inputEl.setAttribute('style', 'width: 300px;')
                        if (this.defaultSettings.label) {
                            text.setValue(this.defaultSettings.label);
                        }
                        text.onChange((value) => {
                            this.settings.label = value;
                        });
                    });

                    text
                        .setPlaceholder("ex) $\\sigma$-algebra")
                        .onChange((value) => {
                            this.settings.title = value;
                            let labelInit = this.settings.title.replaceAll(' ', '-').replaceAll("'s", '').toLowerCase();
                            labelInit = labelInit.replaceAll(/[^a-z0-1\-]/g, '');
                            labelTextComp.setValue(labelInit);
                            this.settings.label = labelInit;
                        })
                });

                dropdown.onChange((value) => {
                    this.settings.type = value;
                    this.env = getTheoremLikeEnv(value);
                    labelPrefixEl.textContent = this.env.prefix + ":";
                });
            });
    }
}


export class MathContextSettingsHelper {
    constructor(
        public contentEl: HTMLElement,
        public settings: MathContextSettings,
        public defaultSettings: MathContextSettings,
        public plugin?: MathPlugin, // passed if called from the plugin's setting tab
    ) { }

    getCallback<Type>(name: keyof MathSettings): (value: Type) => void | Promise<void> {
        let callback = (value: Type): void => {
            Object.assign(this.settings, { [name]: value });
        };
        if (this.plugin) {
            callback = async (value: Type): Promise<void> => {
                Object.assign(this.settings, { [name]: value });
                await this.plugin?.saveSettings();
            };
        }
        return callback;
    }

    addTextSetting(name: keyof MathContextSettings, prettyName?: string, description?: string): Setting {
        prettyName = prettyName ?? name as string;
        let callback = this.getCallback<string>(name);
        let setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        setting.addText((text) => {
            text
                .setValue(String(this.defaultSettings[name]))
                .onChange(callback)
        });
        return setting;
    }

    makeSettingPane(displayRename: boolean, displayLineByLine: boolean, displayEqNumberStyle: boolean) {
        const { contentEl } = this;

        new Setting(contentEl)
            .setName("Language")
            .addDropdown((dropdown) => {
                for (let lang of LanguageManager.supported) {
                    dropdown.addOption(lang, lang);
                }
                dropdown.setValue(this.defaultSettings.lang as string);
                dropdown.onChange(async (value) => {
                    this.settings.lang = value;
                    await this.plugin?.saveSettings();
                });
            });
        this.addTextSetting("number_prefix", "Number prefix", "ex) \"A.\" -> Definition A.1 / Lemma A.2 / Theorem A.3 / ...");
        this.addTextSetting("number_suffix", "Number suffix", "ex) \".\" -> Definition 1. / Lemma 2. / Theorem 3. / ...");
        this.addTextSetting("number_init", "Initial count", 'ex) "5" -> Definition 5 / Lemma 6 / Theorem 7 / ...');
        this.addNumberStyleSetting("number_style", "Math callouts numbering style");
        if (displayEqNumberStyle) {
            this.addNumberStyleSetting("eq_number_style", "Equation numbering style");
        }
        this.addTextSetting("label_prefix", "LaTeX label prefix", 'ex) if "geometry:", a theorem with label="pythhagorean-theorem" will be given a LaTeX label "thm:geometry:pythhagorean-theorem"');

        if (displayRename) {
            this.addRenameSetting();
        }

        this.addTextSetting("preamblePath", "Preamble path");

        if (displayLineByLine) {
            this.addLineByLineSetting();
        }
    }

    addRenameSetting() {
        let { contentEl } = this;
        let renamePane = new Setting(contentEl)
            .setName("Rename environments")
            .setDesc("ex) print \"exercise\" as \"Problem,\" not \"Exercise\"");

        renamePane.addDropdown((dropdown) => {
            for (let envId of ENV_IDs) {
                dropdown.addOption(envId, envId);
            }
            dropdown.onChange((selectedEnvId) => {
                let renamePaneTextBox = new Setting(renamePane.controlEl).addText((text) => {
                    text.onChange((newName) => {
                        if (this.settings.rename === undefined) {
                            this.settings.rename = {} as RenameEnv;
                        }
                        Object.assign(this.settings.rename, { [selectedEnvId]: newName });
                    })
                });
                let inputEl = renamePaneTextBox.settingEl.querySelector<HTMLElement>("input");
                if (inputEl) {
                    renamePaneTextBox.settingEl.replaceWith(inputEl);
                }
            });
        });
    }

    addLineByLineSetting() {
        let setting = new Setting(this.contentEl).setName("Number line by line in align");
        let callback = this.getCallback<boolean>("lineByLine");
        setting.addToggle((toggle) => {
            toggle
                .setValue(this.defaultSettings.lineByLine ?? DEFAULT_SETTINGS.lineByLine)
                .onChange(callback)
        });
        return setting;
    }

    addNumberStyleSetting(name: "number_style" | "eq_number_style", prettyName?: string, description?: string) {
        let setting = new Setting(this.contentEl);
        if (prettyName) {
            setting.setName(prettyName);
        }
        if (description) {
            setting.setDesc(description);
        }
        let callback = this.getCallback<NumberStyle>(name);
        setting.addDropdown((dropdown) => {
            for (let style of ["arabic", "alph", "Alph", "roman", "Roman"]) {
                dropdown.addOption(style, style);
            }
            dropdown
            .setValue(this.defaultSettings[name] ?? DEFAULT_SETTINGS[name])
            .onChange(callback)
        });
        return setting;
    }
}


export function findNearestAncestorContextSettings(plugin: MathPlugin, file: TAbstractFile): MathContextSettings | undefined {
    if (file.path in plugin.settings) {
        return plugin.settings[file.path];
    }
    let folder = file.parent;
    if (folder) {
        while (true) {
            if (folder.isRoot()) {
                return undefined;
            }
            if (folder.path in plugin.settings) {
                return plugin.settings[folder.path];
            }
            if (folder.parent) {
                folder = folder.parent;
            } else {
                throw Error(`Cannot find the parent of ${folder.path}`);
            }
        }
    }
}
