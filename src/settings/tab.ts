import { App, MarkdownView, PluginSettingTab, Setting } from "obsidian";

import MathBooster, { VAULT_ROOT } from "../main";
import { DEFAULT_SETTINGS, MathContextSettings } from "./settings";
import { MathContextSettingsHelper } from "./helper";
import { resolveSettings } from "../utils";
import { ActiveNoteIndexer } from "indexer";
import { ExcludedFileManageModal, LocalContextSettingsSuggestModal } from "modals";


export class MathSettingTab extends PluginSettingTab {
    constructor(app: App, public plugin: MathBooster) {
        super(app, plugin);
    }

    addRestoreDefaultsBottun(key: string) {
        new Setting(this.containerEl)
            .addButton((btn) => {
                btn.setButtonText("Restore defaults");
                btn.onClick(async (event) => {
                    Object.assign(this.plugin.settings[key], DEFAULT_SETTINGS);
                    await this.plugin.saveSettings();
                    this.display();
                })
            });
    }

    displayUnit(key: string) {
        let defaultSettings: MathContextSettings = {};
        let folder = this.app.vault.getAbstractFileByPath(key);
        if (folder) {
            defaultSettings = resolveSettings(undefined, this.plugin, folder);
        }
        (new MathContextSettingsHelper(
            this.containerEl,
            this.plugin.settings[key],
            defaultSettings,
            this.plugin,
        )).makeSettingPane(true, true, true);
        this.addRestoreDefaultsBottun(key);
    }

    display() {
        let { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h4", { text: "Global" });
        this.displayUnit(VAULT_ROOT);

        containerEl.createEl("h4", { text: "Local" });
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

    hide(): any {
        super.hide();

        // run auto-reload so that the new settings comes into effect
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            let cache = this.app.metadataCache.getFileCache(view.file);
            if (cache) {
                let indexer = new ActiveNoteIndexer(this.app, this.plugin, view);
                indexer.run(cache);
            }
        }
    }
}
