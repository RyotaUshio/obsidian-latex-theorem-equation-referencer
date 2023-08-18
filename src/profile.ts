import MathBooster from 'main';
import { THEOREM_LIKE_ENV_IDs, TheoremLikeEnvID } from './env';
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent } from 'obsidian';


export type ProfileMeta = { tags: string[] };
export type ProfileBody = { [k in TheoremLikeEnvID]: string };
export type Profile = {
    id: string;
    meta: ProfileMeta;
    body: ProfileBody;
}

export const DEFAULT_PROFILES: Record<string, Profile> = {
    "English": {
        id: "English",
        meta: {
            tags: ["en"],
        },
        body: {
            "axiom": "Axiom",
            "definition": "Definition",
            "lemma": "Lemma",
            "proposition": "Proposition",
            "theorem": "Theorem",
            "corollary": "Corollary",
            "claim": "Claim",
            "assumption": "Assumption",
            "example": "Example",
            "exercise": "Exercise",
            "conjecture": "Conjecture",
            "hypothesis": "Hypothesis",
            "remark": "Remark",
        }
    },
    "Japanese": {
        id: "Japanese",
        meta: {
            tags: ["ja"],
        },
        body: {
            "axiom": "公理",
            "definition": "定義",
            "lemma": "補題",
            "proposition": "命題",
            "theorem": "定理",
            "corollary": "系",
            "claim": "主張",
            "assumption": "仮定",
            "example": "例",
            "exercise": "演習問題",
            "conjecture": "予想",
            "hypothesis": "仮説",
            "remark": "注",
        }
    },
};


export class ManageProfileModal extends Modal {
    constructor(app: App, public plugin: MathBooster) {
        super(app);
    }

    onOpen() {
        let { contentEl } = this;

        contentEl.empty();
        contentEl.createEl("h3", { text: "Manage profiles" });

        new Setting(contentEl)
            .setName("Add profile")
            .addButton((button) => {
                button.setIcon("plus").onClick(() => {
                    new AddProfileModal(this).open()
                });
            });

        for (const id in this.plugin.extraSettings.profiles) {
            new Setting(contentEl)
                .setName(id)
                .addButton((editButton) => {
                    editButton.setIcon("pencil")
                        .setTooltip("Edit")
                        .setCta()
                        .onClick(() => {
                            new EditProfileModal(
                                this.plugin.extraSettings.profiles[id], 
                                this
                            ).open();
                        });
                }).addButton((editButton) => {
                    editButton.setIcon("copy")
                        .setTooltip("Copy")
                        .onClick(() => {
                            const copied = JSON.parse(JSON.stringify(this.plugin.extraSettings.profiles[id]));
                            copied.id = `Copy of ${id}`;
                            this.plugin.extraSettings.profiles[`Copy of ${id}`] = copied;
                            this.open();
                        });
                }).addButton((deleteButton) => {
                    deleteButton.setIcon("trash-2")
                        .setTooltip("Delete")
                        .onClick(() => {
                            new ConfirmProfileDeletionModal(id, this).open();
                        });
                });
        }
    }

    async onClose() {
        let { contentEl } = this;
        contentEl.empty();
        await this.plugin.saveSettings();
        this.app.metadataCache.trigger("math-booster:extra-settings-updated");
    }
}


class EditProfileModal extends Modal {
    constructor(public profile: Profile, public parent: ManageProfileModal) {
        super(parent.app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: `Edit profile` });

        new Setting(contentEl)
            .setName("Name")
            .addText((text) => {
                text.setValue(this.profile.id)
                    .onChange((value) => {
                        this.profile.id = value;
                    });
            });

        const tagSetting = new Setting(contentEl)
            .setName("Tags")
            .setDesc("Comma-separated list of tags. Only lower-case alphabets or hyphens are allowed. Each tag is converted into a CSS class \".math-callout-<tag>\".")
            .addText((text) => {
                text.setValue(this.profile.meta.tags.join(", "))
                    .onChange((value) => {
                        const tags = value.split(",").map((item) => item.trim());
                        if (tags.every((tag) => tag.match(/^[a-z\-]+$/))) {
                            this.profile.meta.tags = tags;
                        } else {
                            new Notice("A tag can only contain lower-case alphabets or hyphens.", 5000);
                        }
                    });
            });

        contentEl.createEl("h5", { text: "Displayed name" });
        for (const envID of THEOREM_LIKE_ENV_IDs) {
            new Setting(contentEl).setName(envID).addText((text) => {
                text.setValue(this.profile.body[envID] ?? "")
                    .onChange((value) => {
                        this.profile.body[envID] = value;
                    })
            });
        }
    }

    onClose() {
        const profiles = this.parent.plugin.extraSettings.profiles;
        for (const oldID in profiles) {
            const newID = profiles[oldID].id;
            if (newID != oldID) {
                profiles[newID] = profiles[oldID];
                delete profiles[oldID];
            }
        }

        let { contentEl } = this;
        contentEl.empty();
        this.parent.open();
    }
}


class ConfirmProfileDeletionModal extends Modal {
    constructor(public id: string, public parent: ManageProfileModal) {
        super(parent.app);
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h3", { text: "Delete profile" });
        contentEl.createDiv({ text: `Are you sure you want to delete the profile "${this.id}"?` });
        const buttonContainerEl = contentEl.createDiv({ cls: "math-booster-profile-button-container" });
        new ButtonComponent(buttonContainerEl)
            .setButtonText("Delete")
            .setCta()
            .onClick(() => {
                delete this.parent.plugin.extraSettings.profiles[this.id];
                this.close();
            });
        new ButtonComponent(buttonContainerEl)
            .setButtonText("Cancel")
            .onClick(() => {
                this.close();
            });
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
        this.parent.open();
    }
}


class AddProfileModal extends Modal {
    constructor(public parent: ManageProfileModal) {
        super(parent.app);
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.empty();

        let id: string;

        contentEl.createEl("h3", { text: "Add profile" });
        const addProfileEl = contentEl.createDiv({ cls: "math-booster-add-profile" });

        new TextComponent(addProfileEl)
            .setPlaceholder("Enter name...")
            .onChange((value) => {
                id = value;
            });

        const buttonContainerEl = addProfileEl.createDiv({ cls: "math-booster-profile-button-container" });
        new ButtonComponent(buttonContainerEl)
            .setButtonText("Add")
            .setCta()
            .onClick(() => {
                const newBody = {} as ProfileBody;
                for (const envID of THEOREM_LIKE_ENV_IDs) {
                    newBody[envID] = "";
                }
                this.parent.plugin.extraSettings.profiles[id] = {
                    id,
                    meta: { tags: [] },
                    body: newBody
                };
                new EditProfileModal(this.parent.plugin.extraSettings.profiles[id], this.parent).open();
                this.close();
            });
        new ButtonComponent(buttonContainerEl)
            .setButtonText("Cancel")
            .onClick(() => {
                this.close();
            });
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
        this.parent.open();
    }
}
