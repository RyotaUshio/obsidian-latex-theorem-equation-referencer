import MathBooster from 'main';
import { THEOREM_LIKE_ENV_IDs } from './env';
import { App, ButtonComponent, Modal, Setting, TextComponent } from 'obsidian';


export type ProfileMeta = { tags: string[] };
export type ProfileBody = { [k in typeof THEOREM_LIKE_ENV_IDs[number]]: string };
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
                                this.app, 
                                this.plugin.extraSettings.profiles[id]
                            ).open();
                        });
                }).addButton((editButton) => {
                    editButton.setIcon("copy")
                        .setTooltip("Copy")
                        .onClick(() => {
                            this.plugin.extraSettings.profiles[`Copy of ${id}`] = JSON.parse(JSON.stringify(this.plugin.extraSettings.profiles[id]));
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

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}


class EditProfileModal extends Modal {
    constructor(app: App, public profile: Profile) {
        super(app);
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

        new Setting(contentEl)
            .setName("Tags")
            .setDesc("Comma-separated list of tags. Each tag is converted into a CSS class \".math-callout-<tag>\".")
            .addText((text) => {
                text.setValue(this.profile.meta.tags.join(", "))
                    .onChange((value) => {
                        this.profile.meta.tags = value.split(",").map((item) => item.trim());
                        console.log(this.profile);
                    });
            });

        contentEl.createEl("h5", { text: "Displayed name" });
        for (const envID of THEOREM_LIKE_ENV_IDs) {
            new Setting(contentEl).setName(envID).addText((text) => {
                text.setValue(this.profile.body[envID] ?? "")
                    .onChange((value) => {
                        this.profile.body[envID] = value;
                        console.log(this.profile);
                    })
            });
        }
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
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
        new ButtonComponent(contentEl)
            .setButtonText("Delete")
            .setCta()
            .onClick(() => {
                delete this.parent.plugin.extraSettings.profiles[this.id];
                this.close();
                this.parent.open();
            });
        new ButtonComponent(contentEl)
            .setButtonText("Cancel")
            .onClick(() => {
                this.close();
            });
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
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
        const addProfileEl = contentEl.createDiv({cls: "math-booster-add-profile"});

        new TextComponent(addProfileEl)
            .setPlaceholder("Enter name...")
            .onChange((value) => {
                id = value;
            });

        const buttonContainerEl = addProfileEl.createDiv({cls: "math-booster-add-profile-button-container"});
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
                this.parent.open();
                new EditProfileModal(this.app, this.parent.plugin.extraSettings.profiles[id]).open();
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
    }
}
