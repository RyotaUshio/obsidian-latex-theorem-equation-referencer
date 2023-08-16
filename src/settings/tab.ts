import { App, PluginSettingTab, Setting } from "obsidian";

import MathBooster, { VAULT_ROOT } from "../main";
import { DEFAULT_EXTRA_SETTINGS, DEFAULT_SETTINGS } from "./settings";
import { ExtraSettingsHelper, MathContextSettingsHelper } from "./helper";
import { resolveSettings } from "../utils";
import { ExcludedFileManageModal, LocalContextSettingsSuggestModal } from "modals";


export class MathSettingTab extends PluginSettingTab {
    constructor(app: App, public plugin: MathBooster) {
        super(app, plugin);
    }

    addRestoreDefaultsButton() {
        new Setting(this.containerEl)
            .addButton((btn) => {
                btn.setButtonText("Restore defaults");
                btn.onClick(async (event) => {
                    Object.assign(this.plugin.settings[VAULT_ROOT], DEFAULT_SETTINGS);
                    Object.assign(this.plugin.extraSettings, DEFAULT_EXTRA_SETTINGS);
                    await this.plugin.saveSettings();
                    this.plugin.app.metadataCache.trigger("math-booster:local-settings-updated", this.app.vault.getRoot());
                    this.plugin.app.metadataCache.trigger("math-booster:extra-settings-updated");
                    this.display();
                })
            });
    }

    displayUnit(key: string) {
        const file = this.app.vault.getAbstractFileByPath(key);
        if (file) {
            const defaultSettings = resolveSettings(undefined, this.plugin, file);
            (new MathContextSettingsHelper(
                this.containerEl,
                this.plugin.settings[key],
                defaultSettings,
                this.plugin,
                file
            )).makeSettingPane();
        }
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h3", { text: "Global" });
        this.displayUnit(VAULT_ROOT);

        (new ExtraSettingsHelper(
            this.containerEl,
            this.plugin.extraSettings,
            this.plugin.extraSettings,
            this.plugin,
            false
        )).makeSettingPane();

        this.addRestoreDefaultsButton();

        containerEl.createEl("h3", { text: "Local" });
        new Setting(containerEl).setName("Local settings")
            .setDesc("You can set up file-specific or folder-specific configurations, which have more precedence than the global settings.")
            .addButton((btn) => {
                btn.setButtonText("Search files & folders")
                    .onClick((event) => {
                        new LocalContextSettingsSuggestModal(this.app, this.plugin, this).open();
                    });
            });

        new Setting(containerEl)
            .setName("Excluded files")
            .setDesc("You can make your search results more visible by excluding certain files or folders.")
            .addButton((btn) => {
                btn.setButtonText("Manage")
                    .onClick((event) => {
                        new ExcludedFileManageModal(this.app, this.plugin).open();
                    });
            });
    }
}
