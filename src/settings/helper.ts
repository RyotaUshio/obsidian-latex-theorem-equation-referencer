import { ButtonComponent, Setting, SliderComponent, TAbstractFile, TFile, TFolder, TextComponent, ToggleComponent } from 'obsidian';

import MathBooster from '../main';
import { THEOREM_LIKE_ENV_IDs, THEOREM_LIKE_ENVs, TheoremLikeEnvID } from '../env';
import { DEFAULT_SETTINGS, ExtraSettings, LEAF_OPTIONS, THEOREM_REF_FORMATS, THEOREM_CALLOUT_STYLES, TheoremCalloutSettings, MathContextSettings, NUMBER_STYLES } from './settings';
import { BooleanKeys, NumberKeys, formatTheoremCalloutType, formatTitle } from '../utils';
import { AbstractFileIndex, AutoNoteIndexer } from '../indexer';
import { DEFAULT_PROFILES, ManageProfileModal } from './profile';


export class TheoremCalloutSettingsHelper {
    constructor(
        public contentEl: HTMLElement,
        public settings: TheoremCalloutSettings,
        public defaultSettings: Required<MathContextSettings> & Partial<TheoremCalloutSettings>,
        public plugin: MathBooster,
        public file: TFile,
    ) { }

    makeSettingPane() {
        const { contentEl } = this;
        new Setting(contentEl)
            .setName("Type")
            .addDropdown((dropdown) => {
                for (const id of THEOREM_LIKE_ENV_IDs) {
                    const envName = formatTheoremCalloutType(this.plugin, { type: id, profile: this.defaultSettings.profile })
                    dropdown.addOption(id, envName);
                    if (this.defaultSettings.type) {
                        dropdown.setValue(String(this.defaultSettings.type));
                    }
                }

                const initType = dropdown.getValue();
                this.settings.type = initType;

                const numberSetting = new Setting(contentEl).setName("Number");
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
                    .setDesc("You can use inline math.");

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


        new Setting(contentEl).setName("Use this theorem callout to set this note's mathLink").addToggle((toggle) => {
            this.settings.setAsNoteMathLink = this.defaultSettings.setAsNoteMathLink ?? false;
            toggle.setValue(this.settings.setAsNoteMathLink);
            toggle.onChange(async (value) => {
                const cache = this.plugin.app.metadataCache.getFileCache(this.file);
                if (cache) {
                    const indexer = (new AutoNoteIndexer(this.plugin.app, this.plugin, this.file)).getIndexer().calloutIndexer;
                    await indexer.iter(cache, async (theoremCallout) => {
                        theoremCallout.settings.setAsNoteMathLink = false;
                        await indexer.overwriteSettings(
                            theoremCallout.cache.position.start.line,
                            theoremCallout.settings,
                            formatTitle(this.plugin, indexer.resolveSettings(theoremCallout))
                        );
                    });
                    this.settings.setAsNoteMathLink = value; // no need to call indexer.overwriteSettings() here
                }
            });
        });
    }
}


export abstract class SettingsHelper<SettingsType = MathContextSettings | ExtraSettings> {
    settingRefs: Record<keyof SettingsType, Setting>;

    constructor(
        public contentEl: HTMLElement,
        public settings: Partial<SettingsType>,
        public defaultSettings: Required<SettingsType>,
        public plugin: MathBooster,
        public allowUnset: boolean,
        public addClear: boolean,
    ) {
        this.settingRefs = {} as Record<keyof SettingsType, Setting>;
    }

    addClearButton(name: keyof SettingsType, setting: Setting, additionalCallback: () => void) {
        setting.addButton((button) => {
            button.setButtonText("Clear").onClick(async () => {
                delete this.settings[name];
                additionalCallback();
            })
        });
    }

    abstract makeSettingPane(): void;

    addDropdownSetting(name: keyof SettingsType, options: readonly string[], prettyName: string, description?: string, defaultValue?: string) {
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
            dropdown.setValue(
                defaultValue ?? (
                    this.allowUnset
                        ? (this.settings[name] ? this.settings[name] as unknown as string : "")
                        : (this.settings[name] ?? this.defaultSettings[name]) as unknown as string
                )
            );
            dropdown.onChange(async (value: string): Promise<void> => {
                if (this.allowUnset && !value) {
                    delete this.settings[name];
                } else {
                    Object.assign(this.settings, { [name]: value });
                }
            })
        });
        this.settingRefs[name] = setting;
        return setting;
    }

    addTextSetting(name: keyof SettingsType, prettyName: string, description?: string): Setting {
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        let textComponent: TextComponent;
        setting.addText((text) => {
            textComponent = text;
            text.setPlaceholder(String(this.defaultSettings[name] ?? ""))
                .setValue(String(this.settings[name] ?? ""))
                .onChange((value) => {
                    Object.assign(this.settings, { [name]: value });
                })
        });
        if (this.addClear) {
            this.addClearButton(name, setting, () => {
                textComponent.setPlaceholder(String(this.defaultSettings[name] ?? "")).setValue("")
            });
        }
        this.settingRefs[name] = setting;
        return setting;
    }

    addToggleSetting(name: BooleanKeys<SettingsType>, prettyName: string, description?: string) {
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        let toggleComponent: ToggleComponent;
        setting.addToggle((toggle) => {
            toggleComponent = toggle;
            toggle.setValue(this.defaultSettings[name] as unknown as boolean);
            if (typeof this.settings[name] == "boolean") {
                toggle.setValue(this.settings[name] as unknown as boolean);
            }
            toggle.onChange((value) => {
                Object.assign(this.settings, { [name]: value });
            });
        });
        if (this.addClear) {
            this.addClearButton(name, setting, () => {
                toggleComponent.setValue(this.defaultSettings[name] as unknown as boolean)
            });
        }
        this.settingRefs[name] = setting;
        return setting;
    }

    addSliderSetting(name: NumberKeys<SettingsType>, limits: { min: number, max: number, step: number | 'any' }, prettyName: string, description?: string): Setting {
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        let sliderComponent: SliderComponent;
        setting.addSlider((slider) => {
            sliderComponent = slider;
            slider.setLimits(limits.min, limits.max, limits.step)
                .setDynamicTooltip()
                .setValue(this.defaultSettings[name] as unknown as number);
            if (typeof this.settings[name] == "number") {
                slider.setValue(this.settings[name] as unknown as number);
            }
            slider.onChange((value) => {
                Object.assign(this.settings, { [name]: value });
            })
        });
        if (this.addClear) {
            this.addClearButton(name, setting, () => {
                sliderComponent.setValue(this.defaultSettings[name] as unknown as number);
            });
        }
        this.settingRefs[name] = setting;
        return setting;
    }
}


export class MathContextSettingsHelper extends SettingsHelper<MathContextSettings> {
    isRoot: boolean;

    constructor(
        contentEl: HTMLElement,
        settings: Partial<MathContextSettings>,
        defaultSettings: Required<MathContextSettings>,
        plugin: MathBooster,
        public file: TAbstractFile,
    ) {
        const isRoot = file instanceof TFolder && file.isRoot();
        super(contentEl, settings, defaultSettings, plugin, !isRoot, !isRoot);
        this.isRoot = isRoot;
    }

    makeSettingPane() {
        const { contentEl } = this;

        if (!this.isRoot) {
            this.addProjectRootSetting();
        }

        contentEl.createEl("h4", { text: "Theorem callouts" });
        this.addProfileSetting();
        const styleSetting = this.addDropdownSetting("theoremCalloutStyle", THEOREM_CALLOUT_STYLES, "Style");
        styleSetting.descEl.replaceChildren(
            "Choose between your custom style and preset styles. You will need to reload the note to see the changes. See the ",
            createEl("a", { text: "documentation", attr: { href: "https://ryotaushio.github.io/obsidian-math-booster/style-your-theorems.html" } }),
            " for how to customize the appearance of theorem callouts.",
        );
        this.addToggleSetting("theoremCalloutFontInherit", "Don't override the app's font setting when using preset styles", "You will need to reload the note to see the changes.");
        this.addTextSetting("titleSuffix", "Title suffix", "ex) \"\" > Definition 2 (Group) / \".\" > Definition 2 (Group).");
        this.addTextSetting("labelPrefix", "Pandoc label prefix", 'Useful for ensuring no label collision. Ex) When "Pandoc label prefix" = "foo:", A theorem with "Pandoc label" = "bar" is assigned "thm:foo:bar."');
        contentEl.createEl("h6", { text: "Numbering" });
        this.addTextSetting("numberPrefix", "Prefix");
        this.addTextSetting("numberSuffix", "Suffix");
        this.addTextSetting("numberInit", "Initial count");
        this.addDropdownSetting("numberStyle", NUMBER_STYLES, "Style");
        this.addTextSetting("numberDefault", "Default value for the \"Number\" field");
        contentEl.createEl("h6", { text: "Referencing" });
        this.addDropdownSetting("refFormat", THEOREM_REF_FORMATS, "Format");
        this.addDropdownSetting(
            "noteMathLinkFormat",
            THEOREM_REF_FORMATS,
            "Note mathLink format",
            "When a theorem callout's \"Use this theorem callout to set this note's mathLink\" setting is turned on, this format will be used for links to the note containing that theorem callout."
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

        contentEl.createEl("h4", { text: "Proofs" });
        contentEl.createDiv({
            text: `For example, you can replace a pair of inline codes \`${DEFAULT_SETTINGS.beginProof}\` & \`${DEFAULT_SETTINGS.endProof}\` with \"${DEFAULT_PROFILES[DEFAULT_SETTINGS.profile].body.proof.begin}\" & \"${DEFAULT_PROFILES[DEFAULT_SETTINGS.profile].body.proof.end}\". You can style it with CSS snippets. See the documentation for the details.`,
            cls: ["setting-item-description", "math-booster-setting-item-description"]
        });
        this.addTextSetting("beginProof", "Beginning of a proof");
        this.addTextSetting("endProof", "End of a proof");

        this.contentEl.createEl("h3", { text: "Suggestions" });
        this.addToggleSetting("insertSpace", "Insert a space after the link");
    }

    /**
     * This setting actually is NOT related to local/context settings at all.
     * But it makes sense to place it here from the UI perspective.
     * @returns 
     */
    addProjectRootSetting(): Setting | undefined {
        const prettyName = "Set as project root";
        const description = this.file instanceof TFile 
            ? "If turned on, this file itself will be treated as a project." 
            : "If turned on, all the files under this folder will be treated as a single project.";
        let index: AbstractFileIndex | undefined
        if (this.file instanceof TFile) {
            index = this.plugin.index.getNoteIndex(this.file)
        } else if (this.file instanceof TFolder) {
            index = this.plugin.index.getFolderIndex(this.file)
        }
        if (index) {
            const setting = new Setting(this.contentEl).setName(prettyName).setDesc(description);
            setting.addToggle((toggle) => {
                toggle.setValue(index!.isProjectRoot)
                    .onChange((value) => {
                        index!.isProjectRoot = value;
                    });
            });
            return setting;
        }
    }

    addProfileSetting(defaultValue?: string): Setting {
        const profileSetting = this.addDropdownSetting("profile", Object.keys(this.plugin.extraSettings.profiles), "Profile", "A profile defines the displayed name of each environment.", defaultValue);
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
    makeSettingPane(): void {
        this.addToggleSetting("noteTitleInLink", "Show note title at link's head", "If turned on, a link to \"Theorem 1\" will look like \"Note title > Theorem 1.\" The same applies to equations.")
        // Suggest
        this.addTextSetting("triggerSuggest", "Trigger suggestion with", "Type this string to trigger suggestion for theorem callouts & equation blocks.");
        this.addTextSetting("triggerTheoremSuggest", "Trigger theorem suggestion with", "Type this string to trigger suggestion for theorem callouts.");
        this.addTextSetting("triggerEquationSuggest", "Trigger equation suggestion with", "Type this string to trigger suggestion for equation blocks.");
        this.addSliderSetting("suggestNumber", { min: 1, max: 50, step: 1 }, "Number of suggestions", "Specify how many items are suggested at one time. Set it to a smaller value if you have a performance issue when equation suggestions with math rendering on.");
        this.addToggleSetting("renderMathInSuggestion", "Render math in equation suggestions", "Turn this off if you have a performance issue and reducing the number of suggestions doesn't fix it.");
        this.addDropdownSetting("searchMethod", ["Fuzzy", "Simple"], "Search method", "Fuzzy search is more flexible, but simple search is more light-weight.");
        this.addSliderSetting("upWeightRecent", { min: 0, max: 0.5, step: 0.01 }, "Up-weight recently opened notes by", "It takes effect only if \"Search only recently opened notes\" is turned off.");
        this.addToggleSetting("searchOnlyRecent", "Search only recently opened notes", "Turning this on might speed up suggestions.");
        this.addDropdownSetting("modifierToJump", ['Mod', 'Ctrl', 'Meta', 'Shift', 'Alt'], "Modifier key for jumping to suggestion", "Press Enter and this modifier key to jump to the currently selected suggestion. Changing this option requires to reloading " + this.plugin.manifest.name + " to take effect.");
        const list = this.settingRefs.modifierToJump.descEl.createEl("ul");
        list.createEl("li", { text: "Mod is Cmd on MacOS and Ctrl on other OS." });
        list.createEl("li", { text: "Meta is Cmd on MacOS and Win key on Windows." });
        this.addDropdownSetting("suggestLeafOption", LEAF_OPTIONS, "Opening option", "Specify how to open the selected suggestion.")
        // backlinks
        this.contentEl.createEl("h3", { text: "Backlinks" });
        this.contentEl.createDiv({
            text: `Right-click a theorem callout or an equation and select \"Show backlinks\" to see its backlinks.`,
            cls: ["setting-item-description", "math-booster-setting-item-description"],
        });
        this.addDropdownSetting("backlinkLeafOption", LEAF_OPTIONS, "Opening option", "Specify how to open the selected backlink.")
    }
}
