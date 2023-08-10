import { Setting, TextComponent } from 'obsidian';

import MathBooster from '../main';
import { ENV_IDs, ENVs, TheoremLikeEnv, getTheoremLikeEnv } from '../env';
import { DEFAULT_SETTINGS, MathCalloutSettings, MathContextSettings, MathSettings, NumberStyle, RenameEnv } from './settings';
import LanguageManager from '../language';


export class MathCalloutSettingsHelper {
    env: TheoremLikeEnv;
    constructor(
        public contentEl: HTMLElement,
        public settings: MathCalloutSettings,
        public defaultSettings: Partial<MathSettings>,
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
                        this.defaultSettings.number ?? this.defaultSettings.numberDefault ?? DEFAULT_SETTINGS.numberDefault
                    );
                    this.settings.number = text.getValue();
                    text.onChange((value) => {
                        this.settings.number = value;
                    });
                })

                let titlePane = new Setting(contentEl)
                    .setName("Title")
                    .setDesc("You may use inline math");


                let labelPane = new Setting(contentEl).setName("LaTeX Label");
                let labelPrefixEl = labelPane.controlEl.createDiv({
                    text: this.env.prefix + ":" + (this.defaultSettings.labelPrefix ?? "")
                });

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
                    if (this.defaultSettings.labelPrefix) {
                        labelPrefixEl.textContent += this.defaultSettings.labelPrefix;
                    }
                });
            });
    }
}


export class MathContextSettingsHelper {
    constructor(
        public contentEl: HTMLElement,
        public settings: MathContextSettings,
        public defaultSettings: MathContextSettings,
        public plugin?: MathBooster, // passed if called from the plugin's setting tab
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
                .setPlaceholder(String(this.defaultSettings[name] ?? ""))
                .setValue(String(this.settings[name] ?? ""))
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
        this.addTextSetting("typeSuffix", "Type suffix", "ex) \".\" > Definition. \"\" (default) > Definition");
        this.addTextSetting("numberPrefix", "Number prefix", "ex) \"A.\" > Definition A.1 / Lemma A.2 / Theorem A.3 / ...");
        this.addTextSetting("numberSuffix", "Number suffix", "ex) \".\" > Definition 1. / Lemma 2. / Theorem 3. / ...");
        this.addTextSetting("numberInit", "Initial count", 'ex) "5" > Definition 5 / Lemma 6 / Theorem 7 / ...');
        this.addNumberStyleSetting("numberStyle", "Math callouts numbering style");
        this.addTextSetting("numberDefault", "Default value for the \"Number\" field");
        if (displayEqNumberStyle) {
            this.addNumberStyleSetting("eqNumberStyle", "Equation numbering style");
        }
        this.addTextSetting("labelPrefix", "LaTeX label prefix", 'ex) "geometry:" > a theorem with label="pythhagorean-theorem" will be given a LaTeX label "thm:geometry:pythhagorean-theorem"');

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

    addNumberStyleSetting(name: "numberStyle" | "eqNumberStyle", prettyName?: string, description?: string) {
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
