import { ButtonComponent, Setting, SliderComponent, TAbstractFile, TFile, TFolder, TextComponent, ToggleComponent } from 'obsidian';

import MathBooster from 'main';
import { THEOREM_LIKE_ENV_IDs, THEOREM_LIKE_ENVs, TheoremLikeEnvID } from 'env';
import { DEFAULT_SETTINGS, ExtraSettings, LEAF_OPTIONS, THEOREM_REF_FORMATS, THEOREM_CALLOUT_STYLES, TheoremCalloutSettings, MathContextSettings, NUMBER_STYLES } from 'settings/settings';
import { formatTheoremCalloutType } from 'utils/format';
import { NumberKeys, BooleanKeys } from 'utils/general';
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
                    .setDesc("You can include inline math in the title.");

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
                        .setPlaceholder("Ex) $\\sigma$-algebra")
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


        // new Setting(contentEl).setName("Use this theorem callout to set this note's mathLink").addToggle((toggle) => {
        //     this.settings.setAsNoteMathLink = this.defaultSettings.setAsNoteMathLink ?? false;
        //     toggle.setValue(this.settings.setAsNoteMathLink);
        //     toggle.onChange(async (value) => {
        //         const cache = this.plugin.app.metadataCache.getFileCache(this.file);
        //         if (cache) {
        //             const indexer = (new AutoNoteIndexer(this.plugin.app, this.plugin, this.file)).getIndexer().calloutIndexer;
        //             await indexer.iter(cache, async (theoremCallout) => {
        //                 theoremCallout.settings.setAsNoteMathLink = false;
        //                 await indexer.overwriteSettings(
        //                     theoremCallout.cache.position.start.line,
        //                     theoremCallout.settings,
        //                     formatTitle(this.plugin, this.file, indexer.resolveSettings(theoremCallout))
        //                 );
        //             });
        //             this.settings.setAsNoteMathLink = value; // no need to call indexer.overwriteSettings() here
        //         }
        //     });
        // });
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

    addTextSetting(name: keyof SettingsType, prettyName: string, description?: string, number: boolean = false): Setting {
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        let textComponent: TextComponent;
        setting.addText((text) => {
            textComponent = text;
            text.setPlaceholder(String(this.defaultSettings[name] ?? ""))
                .setValue(String(this.settings[name] ?? ""))
                .onChange((value: string) => {
                    if (number) {
                        Object.assign(this.settings, { [name]: +value });
                    } else {
                        Object.assign(this.settings, { [name]: value });
                    }
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
    constructor(
        contentEl: HTMLElement,
        settings: Partial<MathContextSettings>,
        defaultSettings: Required<MathContextSettings>,
        plugin: MathBooster,
        public file: TAbstractFile,
    ) {
        const isRoot = file instanceof TFolder && file.isRoot();
        super(contentEl, settings, defaultSettings, plugin, !isRoot, !isRoot);
    }

    makeSettingPane() {
        const { contentEl } = this;

        contentEl.createEl("h4", { text: "Theorem callouts" });
        this.addProfileSetting();
        const styleSetting = this.addDropdownSetting("theoremCalloutStyle", THEOREM_CALLOUT_STYLES, "Style");
        styleSetting.descEl.replaceChildren(
            "Choose between your custom style and preset styles. You will need to reload the note to see the changes. See the ",
            createEl("a", { text: "documentation", attr: { href: "https://ryotaushio.github.io/obsidian-math-booster/style-your-theorems.html" } }),
            " for how to customize the appearance of theorem callouts. \"Custom\" is recommended, since it will give you the most control. You can view the CSS snippets for all the preset styles in the documentation or README on GitHub. The preset styles are only for a trial purpose, and they might not work well with some non-default themes.",
        );
        this.addToggleSetting("theoremCalloutFontInherit", "Don't override the app's font setting when using preset styles", "You will need to reload the note to see the changes.");
        this.addTextSetting("titleSuffix", "Title suffix", "Ex) \"\" > Definition 2 (Group) / \".\" > Definition 2 (Group).");
        this.addTextSetting("labelPrefix", "Pandoc label prefix", 'Useful for ensuring no label collision. Ex) When "Pandoc label prefix" = "foo:", A theorem with "Pandoc label" = "bar" is assigned "thm:foo:bar."');
        contentEl.createEl("h6", { text: "Numbering" });
        this.addToggleSetting(
            "inferNumberPrefix", 
            "Infer prefix from note title or properties", 
            `Automatically infer a prefix from the note title or properties. If the inference source (title or property) contains whitespaces, the substring before the first whitespace will be parsed for generating a prefix. Ex) To infer a prefix \"1.2.\" from a property "section" with value "1.2-A", set `
            + `"Use property as source" = "section", `
            + `"Delimiter for parsing" = "-." (i.e. recognize "-" or "." in the note title as a delimiter), `
            + `"Delimiter for generating prefix" = ".", `
            + `and "Use first N" = 2.`
        );
        this.addTextSetting("inferNumberPrefixFromProperty", "Use property as source", "If set, use this property as the source of prefix inference. If not set, the note title will be used as the source.")
        this.addTextSetting("inferNumberPrefixParseSep", "Delimiter for parsing");
        this.addTextSetting("inferNumberPrefixPrintSep", "Delimiter for generating prefix");
        this.addTextSetting("inferNumberPrefixUseFirstN", "Use first N", undefined, true);
        this.addTextSetting("numberPrefix", "Manual prefix", "Even if \"Infer prefix from note title or properties\" is turned on, the inferred prefix will be overwritten by the value set here.");
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
        this.addToggleSetting(
            "inferEqNumberPrefix", 
            "Infer prefix from note title", 
            `Automatically infer a prefix from the note title. If the title contains whitespaces, the substring before the first whitespace will be parsed for generating a prefix. Ex) To infer a prefix \"1.2.\" from a note \"1.2-A foo.md\", set `
            + `"Delimiter for parsing note title" = "-." (i.e. recognize "-" or "." in the note title as a delimiter), `
            + `"Delimiter for generating prefix" = ".", `
            + `and "Use first N" = 2.`
        );
        this.addTextSetting("inferEqNumberPrefixFromProperty", "Use property as source", "If set, use this property as the source of prefix inference. If not set, the note title will be used as the source.")
        this.addTextSetting("inferEqNumberPrefixParseSep", "Delimiter for parsing");
        this.addTextSetting("inferEqNumberPrefixPrintSep", "Delimiter for generating prefix");
        this.addTextSetting("inferEqNumberPrefixUseFirstN", "Use first N", undefined, true);
        this.addTextSetting("eqNumberPrefix", "Manual prefix", "Even if \"Infer prefix from note title\" is turned on, the inferred prefix will be overwritten by the value set here.");
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
        this.addToggleSetting("showTheoremCalloutEditButton", "Show an edit button on a theorem callout");

        // Suggest
        this.contentEl.createEl("h4", { text: "Theorem & equation suggestion" });
        this.contentEl.createEl("h5", { text: "From entire vault" });
        this.addToggleSetting("enableSuggest", "Enable");
        this.addTextSetting("triggerSuggest", "Trigger");
        this.contentEl.createEl("h5", { text: "From recent notes" });
        this.addToggleSetting("enableSuggestRecentNotes", "Enable");
        this.addTextSetting("triggerSuggestRecentNotes", "Trigger");
        this.contentEl.createEl("h5", { text: "From active note" });
        this.addToggleSetting("enableSuggestActiveNote", "Enable");
        this.addTextSetting("triggerSuggestActiveNote", "Trigger");

        this.contentEl.createEl("h4", { text: "Theorem suggestion" });
        this.contentEl.createEl("h5", { text: "From entire vault" });
        this.addToggleSetting("enableTheoremSuggest", "Enable");
        this.addTextSetting("triggerTheoremSuggest", "Trigger");
        this.contentEl.createEl("h5", { text: "From recent notes" });
        this.addToggleSetting("enableTheoremSuggestRecentNotes", "Enable");
        this.addTextSetting("triggerTheoremSuggestRecentNotes", "Trigger");
        this.contentEl.createEl("h5", { text: "From active note" });
        this.addToggleSetting("enableTheoremSuggestActiveNote", "Enable");
        this.addTextSetting("triggerTheoremSuggestActiveNote", "Trigger");
        
        this.contentEl.createEl("h4", { text: "Equation suggestion" });
        this.contentEl.createEl("h5", { text: "From entire vault" });
        this.addToggleSetting("enableEquationSuggest", "Enable");
        this.addTextSetting("triggerEquationSuggest", "Trigger");
        this.contentEl.createEl("h5", { text: "From recent notes" });
        this.addToggleSetting("enableEquationSuggestRecentNotes", "Enable");
        this.addTextSetting("triggerEquationSuggestRecentNotes", "Trigger");
        this.contentEl.createEl("h5", { text: "From active note" });
        this.addToggleSetting("enableEquationSuggestActiveNote", "Enable");
        this.addTextSetting("triggerEquationSuggestActiveNote", "Trigger");
        
        this.contentEl.createEl("h4", { text: "General" });
        this.addSliderSetting("suggestNumber", { min: 1, max: 50, step: 1 }, "Number of suggestions", "Specify how many items are suggested at one time. Set it to a smaller value if you have a performance issue when equation suggestions with math rendering on.");
        this.addToggleSetting("renderMathInSuggestion", "Render math in equation suggestions", "Turn this off if you have a performance issue and reducing the number of suggestions doesn't fix it.");
        this.addDropdownSetting("searchMethod", ["Fuzzy", "Simple"], "Search method", "Fuzzy search is more flexible, but simple search is more light-weight.");
        this.addToggleSetting("searchTags", "Include note tags for search target");
        this.addToggleSetting("searchLabel", "Include theorem callout label for search target");
        this.addSliderSetting("upWeightRecent", { min: 0, max: 0.5, step: 0.01 }, "Up-weight recently opened notes by", "It takes effect only if \"Search only recently opened notes\" is turned off.");
        // this.addToggleSetting("searchOnlyRecent", "Search only recently opened notes", "Turning this on might speed up suggestions.");
        this.addDropdownSetting("modifierToJump", ['Mod', 'Ctrl', 'Meta', 'Shift', 'Alt'], "Modifier key for jumping to suggestion", "Press Enter and this modifier key to jump to the currently selected suggestion. Changing this option requires to reloading " + this.plugin.manifest.name + " to take effect.");
        this.addDropdownSetting("modifierToNoteLink", ['Mod', 'Ctrl', 'Meta', 'Shift', 'Alt'], "Modifier key for insert link to note", "Press Enter and this modifier key to insert a link to the note containing the currently selected item. Changing this option requires to reloading " + this.plugin.manifest.name + " to take effect.");
        this.addToggleSetting("showModifierInstruction", "Show modifier key instruction", "Show the instruction for the modifier key at the bottom of suggestion box. " + `Changing this option requires to reloading ${this.plugin.manifest.name} to take effect.`);
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

        // projects
        // this.addTextSetting("projectInfix", "Link infix", "Specify the infix to connect a project name and a theorem title or an equation number.");
        // this.addTextSetting("projectSep", "Separator for nested projects");

        // indexer/importer
        this.contentEl.createEl("h3", { text: "Indexing" });
        this.addSliderSetting('importerNumThreads', {min: 1, max: 10, step: 1}, "Indexer threads", "The maximum number of thread used for indexing.");
        this.addSliderSetting('importerUtilization', {min: 0.1, max: 1.0, step: 0.01}, 'Indexer CPU utilization', "The CPU utilization that indexer threads should use.");
    }
}


// export class ProjectSettingsHelper {
//     plugin: MathBooster;
//     file: TAbstractFile;

//     constructor(public contentEl: HTMLElement, public parent: ContextSettingModal) {
//         this.plugin = parent.plugin;
//         this.file = parent.file;
//     }

//     makeSettingPane() {
//         const project = this.plugin.projectManager.getProject(this.file);
//         const noteOrFolder = this.file instanceof TFile ? "note" : "folder";
//         let status = "";
//         if (project) {
//             if (project.root == this.file) {
//                 status = `This ${noteOrFolder} is a project's root.`;
//             } else {
//                 status = `This ${noteOrFolder} belongs to the project "${project.name}" (root: ${project.root.path}).`;
//             }
//         } else {
//             status = `This ${noteOrFolder} doesn't belong to any project.`;
//         }

//         this.contentEl.createEl("h4", {text: "Project (experimental)"})

//         this.contentEl.createDiv({
//             text: PROJECT_DESCRIPTION + " " + status,
//             cls: ["setting-item-description", "math-booster-setting-item-description"]
//         });
//         this.addRootSetting();
//         if (project) {
//             this.addNameSetting(project);
//         }
//     }

//     addRootSetting(): Setting | undefined {
//         const prettyName = "Set as project root";
//         const description = this.file instanceof TFile
//             ? "If turned on, this file itself will be treated as a project."
//             : "If turned on, all the files under this folder will be treated as a single project.";
//         let index: AbstractFileIndex | undefined
//         if (this.file instanceof TFile) {
//             index = this.plugin.index.getNoteIndex(this.file)
//         } else if (this.file instanceof TFolder) {
//             index = this.plugin.index.getFolderIndex(this.file)
//         }
//         if (index) {
//             const setting = new Setting(this.contentEl).setName(prettyName).setDesc(description);
//             setting.addToggle((toggle) => {
//                 toggle.setValue(index!.isProjectRoot)
//                     .onChange((value) => {
//                         if (value) {
//                             this.plugin.projectManager.add(this.file);
//                         } else {
//                             this.plugin.projectManager.delete(this.file);
//                         }
//                         this.parent.close();
//                         this.parent.open();
//                     });
//             });
//             return setting;
//         }
//     }

//     addNameSetting(project: Project): Setting {
//         const prettyName = "Project name";
//         const description = "A project name can contain inline math and doesn't have to be unique.";
//         const setting = new Setting(this.contentEl).setName(prettyName).setDesc(description);

//         setting.addText((text) => {
//             text.setValue(project.name)
//                 .onChange((value) => {
//                     project.name = value;
//                 })
//         });
//         return setting;
//     }
// }
