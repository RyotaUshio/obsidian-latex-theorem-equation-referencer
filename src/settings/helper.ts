import { ButtonComponent, Setting, TAbstractFile, TFile, TFolder, TextComponent } from 'obsidian';

import MathBooster from '../main';
import { THEOREM_LIKE_ENV_IDs, THEOREM_LIKE_ENVs, TheoremLikeEnvID } from '../env';
import { ExtraSettings, MATH_CALLOUT_REF_FORMATS, MATH_CALLOUT_STYLES, MathCalloutSettings, MathContextSettings, NUMBER_STYLES } from './settings';
import { BooleanKeys, formatMathCalloutType, formatTitle } from '../utils';
import { AutoNoteIndexer } from 'indexer';
import { ManageProfileModal } from 'profile';


export class MathCalloutSettingsHelper {
    constructor(
        public contentEl: HTMLElement,
        public settings: MathCalloutSettings,
        public defaultSettings: Required<MathContextSettings> & Partial<MathCalloutSettings>,
        public plugin: MathBooster,
        public file: TFile,
    ) { }

    makeSettingPane() {
        const { contentEl } = this;
        new Setting(contentEl)
            .setName("Type")
            .addDropdown((dropdown) => {
                for (const id of THEOREM_LIKE_ENV_IDs) {
                    const envName = formatMathCalloutType(this.plugin, { type: id, profile: this.defaultSettings.profile })
                    dropdown.addOption(id, envName);
                    if (this.defaultSettings.type) {
                        dropdown.setValue(String(this.defaultSettings.type));
                    }
                }

                const initType = dropdown.getValue();
                this.settings.type = initType;

                const numberSetting = new Setting(contentEl)
                    .setName("Number")
                    .setDesc("Allowed values:");
                const numberSettingDescList = numberSetting.descEl.createEl("ul");
                numberSettingDescList.createEl(
                    "li",
                    { text: '"auto" - automatically numbered' }
                );
                numberSettingDescList.createEl(
                    "li",
                    { text: "blank - unnumbered" }
                );
                numberSettingDescList.createEl(
                    "li",
                    { text: "otherwise - used as is" }
                );

                numberSetting.addText((text) => {
                    text.setValue(
                        this.defaultSettings.number ?? this.defaultSettings.numberDefault
                    );
                    this.settings.number = text.getValue();
                    text.onChange((value) => {
                        this.settings.number = value;
                    });
                })

                const titlePane = new Setting(contentEl)
                    .setName("Title")
                    .setDesc("You may use inline math");

                const labelPane = new Setting(contentEl).setName("Pandoc label");
                const labelPrefixEl = labelPane.controlEl.createDiv({
                    text: THEOREM_LIKE_ENVs[this.settings.type as TheoremLikeEnvID].prefix + ":" + (this.defaultSettings.labelPrefix ?? "")
                });

                titlePane.addText((text) => {
                    text.inputEl.classList.add("math-booster-title-form");
                    if (this.defaultSettings.title) {
                        text.setValue(this.defaultSettings.title);
                    }

                    let labelTextComp: TextComponent;
                    labelPane.addText((text) => {
                        labelTextComp = text;
                        text.inputEl.classList.add("math-booster-label-form");
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
                    labelPrefixEl.textContent = THEOREM_LIKE_ENVs[this.settings.type as TheoremLikeEnvID].prefix + ":";
                    if (this.defaultSettings.labelPrefix) {
                        labelPrefixEl.textContent += this.defaultSettings.labelPrefix;
                    }
                });
            });


        new Setting(contentEl).setName("Use this math callout to set this note's mathLink").addToggle((toggle) => {
            this.settings.setAsNoteMathLink = this.defaultSettings.setAsNoteMathLink ?? false;
            toggle.setValue(this.settings.setAsNoteMathLink);
            toggle.onChange(async (value) => {
                const cache = this.plugin.app.metadataCache.getFileCache(this.file);
                if (cache) {
                    const indexer = (new AutoNoteIndexer(this.plugin.app, this.plugin, this.file)).getIndexer().calloutIndexer;
                    await indexer.iter(cache, async (mathCallout) => {
                        mathCallout.settings.setAsNoteMathLink = false;
                        await indexer.overwriteSettings(
                            mathCallout.cache.position.start.line,
                            mathCallout.settings,
                            formatTitle(this.plugin, indexer.resolveSettings(mathCallout))
                        );
                    });
                    this.settings.setAsNoteMathLink = value; // no need to call indexer.overwriteSettings() here
                }
            });
        });
    }
}


export abstract class SettingsHelper<SettingsType = MathContextSettings | ExtraSettings> {
    abstract readonly eventName: string;
    abstract readonly eventArgs: any[];

    constructor(
        public contentEl: HTMLElement,
        public settings: Partial<SettingsType>,
        public defaultSettings: Required<SettingsType>,
        public plugin: MathBooster,
        public allowUnset: boolean,
    ) { }

    getCallback<Type>(name: keyof SettingsType): (value: Type) => Promise<void> {
        return async (value: Type): Promise<void> => {
            Object.assign(this.settings, { [name]: value });
            await this.plugin.saveSettings();
            this.plugin.app.metadataCache.trigger(this.eventName, ...this.eventArgs);
        }
    }

    abstract makeSettingPane(): void;

    addDropdownSetting(name: keyof SettingsType, options: readonly string[], prettyName: string, description?: string, defaultValue?: string) {
        const callback = this.getCallback<string>(name);
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        setting.addDropdown((dropdown) => {
            if (this.allowUnset) {
                dropdown.addOption("", "");
            }
            for (const option of options) {
                dropdown.addOption(option, option);
            }
            console.log("defaultValue:", defaultValue);
            dropdown.setValue(
                defaultValue ??
                this.allowUnset
                    ? (this.settings[name] ? this.defaultSettings[name] as unknown as string : "")
                    : this.defaultSettings[name] as unknown as string
            ).onChange(callback);
        });
        return setting;
    }

    addTextSetting(name: keyof SettingsType, prettyName: string, description?: string): Setting {
        const callback = this.getCallback<string>(name);
        const setting = new Setting(this.contentEl).setName(prettyName);
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

    addToggleSetting(name: BooleanKeys<SettingsType>, prettyName: string, description?: string) {
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        const callback = this.getCallback<boolean>(name);
        setting.addToggle((toggle) => {
            toggle.setValue(this.defaultSettings[name] as unknown as boolean)
                .onChange(callback);
        });
        return setting;
    }
}


export class MathContextSettingsHelper extends SettingsHelper<MathContextSettings> {
    eventName: string = "math-booster:local-settings-updated";
    eventArgs: TAbstractFile[];

    constructor(
        contentEl: HTMLElement,
        settings: Partial<MathContextSettings>,
        defaultSettings: MathContextSettings,
        plugin: MathBooster,
        public file: TAbstractFile,
    ) {
        super(contentEl, settings, defaultSettings, plugin, !(file instanceof TFolder && file.isRoot()))
        this.eventArgs = [this.file];
    }

    makeSettingPane() {
        const { contentEl } = this;

        contentEl.createEl("h4", { text: "Math callouts" });
        this.addProfileSetting();
        const styleSetting = this.addDropdownSetting("mathCalloutStyle", MATH_CALLOUT_STYLES, "Style");
        styleSetting.descEl.replaceChildren(
            "Choose between your custom style and preset styles. You will need to reload the note to see the changes. See the ",
            createEl("a", { text: "documentation", attr: { href: "https://ryotaushio.github.io/obsidian-math-booster/style-your-theorems.html" } }),
            " for how to customize the appearance of math callouts.",
        );
        this.addToggleSetting("mathCalloutFontInherit", "Don't override the app's font setting when using preset styles", "You will need to reload the note to see the changes.");
        this.addTextSetting("titleSuffix", "Title suffix", "ex) \"\" > Definition 2 (Group) / \".\" > Definition 2 (Group).");
        this.addTextSetting("labelPrefix", "Pandoc label prefix", 'ex) "geometry:" > a theorem with label="pythhagorean-theorem" will be given a LaTeX label "thm:geometry:pythhagorean-theorem"');
        contentEl.createEl("h6", { text: "Numbering" });
        this.addTextSetting("numberPrefix", "Prefix");
        this.addTextSetting("numberSuffix", "Suffix");
        this.addTextSetting("numberInit", "Initial count");
        this.addDropdownSetting("numberStyle", NUMBER_STYLES, "Style");
        this.addTextSetting("numberDefault", "Default value for the \"Number\" field");
        contentEl.createEl("h6", { text: "Referencing" });
        this.addDropdownSetting("refFormat", MATH_CALLOUT_REF_FORMATS, "Format");
        this.addDropdownSetting(
            "noteMathLinkFormat",
            MATH_CALLOUT_REF_FORMATS,
            "Note mathLink format",
            "When a math callout's \"Use this math callout to set this note's mathLink\" setting is turned on, this format will be used for links to the note containing that math callout."
        );

        contentEl.createEl("h4", { text: "Equations" });
        contentEl.createEl("h6", { text: "Numbering" });
        this.addTextSetting("eqNumberPrefix", "Prefix");
        this.addTextSetting("eqNumberSuffix", "Suffix");
        this.addTextSetting("eqNumberInit", "Initial count");
        this.addDropdownSetting("eqNumberStyle", NUMBER_STYLES, "Style");
        this.addToggleSetting("lineByLine", "Number line by line in align");
        contentEl.createEl("h6", { text: "Referencing" });
        this.addTextSetting("eqRefPrefix", "Prefix");
        this.addTextSetting("eqRefSuffix", "Suffix");
    }

    addProfileSetting(defaultValue?: string): Setting {
        const profileSetting = this.addDropdownSetting("profile", Object.keys(this.plugin.extraSettings.profiles), "Profile", undefined, defaultValue);
        new ButtonComponent(profileSetting.controlEl)
            .setButtonText("Manage profiles")
            .onClick(() => {
                new ManageProfileModal(this.plugin, this, profileSetting).open();
            });
        profileSetting.controlEl.classList.add("math-booster-profile-setting");
        return profileSetting;
    }
}


export class ExtraSettingsHelper extends SettingsHelper<ExtraSettings> {
    eventName: string = "math-booster:extra-settings-updated";
    eventArgs: never[] = [];

    makeSettingPane(): void {
        this.addToggleSetting("noteTitleInLink", "Show note title at link's head", "If turned on, a link to \"Theorem 1\" will look like \"Note title > Theorem 1.\" The same applies to equations.")
    }
}
