import { App, PluginSettingTab, Setting } from "obsidian";

import MathBooster, { VAULT_ROOT } from "../main";
import { DEFAULT_EXTRA_SETTINGS, DEFAULT_SETTINGS } from "./settings";
import { ExtraSettingsHelper, MathContextSettingsHelper } from "./helper";
import { ExcludedFileManageModal, LocalContextSettingsSuggestModal } from "settings/modals";
// import { PROJECT_DESCRIPTION } from "project";


export class MathSettingTab extends PluginSettingTab {
    constructor(app: App, public plugin: MathBooster) {
        super(app, plugin);
    }

    addRestoreDefaultsButton() {
        new Setting(this.containerEl)
            .addButton((btn) => {
                btn.setButtonText("Restore defaults");
                btn.onClick(async () => {
                    Object.assign(this.plugin.settings[VAULT_ROOT], DEFAULT_SETTINGS);
                    Object.assign(this.plugin.extraSettings, DEFAULT_EXTRA_SETTINGS);
                    this.display();
                })
            });
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h3", { text: "Global" });

        const root = this.app.vault.getRoot();
        const globalHelper = new MathContextSettingsHelper(
            this.containerEl,
            this.plugin.settings[VAULT_ROOT],
            DEFAULT_SETTINGS,
            this.plugin,
            root
        );
        globalHelper.makeSettingPane();

        const extraHelper = new ExtraSettingsHelper(
            this.containerEl,
            this.plugin.extraSettings,
            this.plugin.extraSettings,
            this.plugin,
            false, 
            false
        );
        extraHelper.makeSettingPane();

        this.containerEl.insertAfter(
            extraHelper.settingRefs.showTheoremCalloutEditButton.settingEl, 
            globalHelper.settingRefs.profile.settingEl
        );
        this.containerEl.insertBefore(
            extraHelper.settingRefs.foldDefault.settingEl, 
            globalHelper.settingRefs.labelPrefix.settingEl
        );
        this.containerEl.insertBefore(
            extraHelper.settingRefs.setOnlyTheoremAsMain.settingEl, 
            globalHelper.settingRefs.labelPrefix.settingEl
        );
        this.containerEl.insertBefore(
            extraHelper.settingRefs.setLabelInModal.settingEl, 
            globalHelper.settingRefs.labelPrefix.settingEl
        );
        this.containerEl.insertBefore(
            extraHelper.settingRefs.noteTitleInLink.settingEl, 
            globalHelper.settingRefs.noteMathLinkFormat.settingEl
        );

        this.containerEl.insertBefore(
            globalHelper.settingRefs.insertSpace.settingEl,
            extraHelper.settingRefs.searchMethod.settingEl,
        );

        // const projectHeading = containerEl.createEl("h3", { text: "Projects (experimental)" });
        // const projectDesc = containerEl.createDiv({
        //     text: PROJECT_DESCRIPTION,
        //     cls: ["setting-item-description", "math-booster-setting-item-description"]
        // });

        // this.containerEl.insertBefore(
        //     projectHeading,
        //     extraHelper.settingRefs.projectInfix.settingEl
        // );
        // this.containerEl.insertAfter(
        //     projectDesc,
        //     projectHeading,
        // );

        this.addRestoreDefaultsButton();

        containerEl.createEl("h3", { text: "Local" });
        new Setting(containerEl).setName("Local settings")
            .setDesc("You can set up local (i.e. file-specific or folder-specific) settings, which have more precedence than the global settings. Local settings can be configured in various ways; here in the plugin settings, right-clicking in the file explorer, the \"Open local settings for the current file\" command, and the \"Open local settings for the current file\" button in the theorem callout settings pop-ups.")
            .addButton((btn) => {
                btn.setButtonText("Search files & folders")
                    .onClick(() => {
                        new LocalContextSettingsSuggestModal(this.app, this.plugin, this).open();
                    });
            });

        new Setting(containerEl)
            .setName("Excluded files")
            .setDesc("You can make your search results more visible by excluding certain files or folders.")
            .addButton((btn) => {
                btn.setButtonText("Manage")
                    .onClick(() => {
                        new ExcludedFileManageModal(this.app, this.plugin).open();
                    });
            });
    }

    async hide() {
        super.hide();
        await this.plugin.saveSettings();
        this.app.metadataCache.trigger("math-booster:global-settings-updated");
    }
}
