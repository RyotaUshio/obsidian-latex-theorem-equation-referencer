import { Modal, Setting, Component, MarkdownRenderer, App, Notice } from "obsidian";

import MathBooster from "main";
import { isPluginOlderThan } from "utils/obsidian";
import { rewriteTheoremCalloutFromV1ToV2 } from "theorem_callouts";


export class DependencyNotificationModal extends Modal {
    component: Component;

    constructor(public plugin: MathBooster, public dependenciesOK: boolean, public v1: boolean) {
        super(plugin.app);
        this.component = new Component();
        this.plugin.addChild(this.component);
    }

    async onOpen() {
        const { contentEl, titleEl } = this;
        contentEl.empty();

        titleEl.setText(`${this.plugin.manifest.name} ${this.plugin.manifest.version}`)

        if (!this.dependenciesOK) this.showDependencies();

        if (this.v1) this.showMigrationGuild();
    }

    showDependencies() {
        this.contentEl.createDiv({
            text: `${this.plugin.manifest.name} requires the following plugins to work properly. Disable it once, install/update & enable the dependencies and enable it again.`,
            attr: { style: "margin-bottom: 1em;" }
        });

        // Validity indicator is taken from the Latex Suite plugin (https://github.com/artisticat1/obsidian-latex-suite/blob/a5914c70c16d5763a182ec51d9716110b40965cf/src/settings.ts)
        for (const depenedency of [
            { id: "mathlinks", name: "MathLinks" },
            // { id: "dataview", name: "Dataview" }
        ]) {
            const depPlugin = this.app.plugins.getPlugin(depenedency.id);
            const requiredVersion = this.plugin.dependencies[depenedency.id];
            const isValid = depPlugin && !isPluginOlderThan(depPlugin, requiredVersion);
            const setting = new Setting(this.contentEl)
                .setName(depenedency.name)
                .addExtraButton((button) => {
                    button.setIcon(isValid ? "checkmark" : "cross");
                    const el = button.extraSettingsEl;
                    el.addClass("math-booster-dependency-validation");
                    el.removeClass(isValid ? "invalid" : "valid");
                    el.addClass(isValid ? "valid" : "invalid");
                });
            setting.descEl.createDiv(
                {
                    text:
                        `Required version: ${requiredVersion}+ / `
                        + (depPlugin ? `Currently installed: ${depPlugin.manifest.version}`
                            : `Not installed or enabled`)
                }
            );
        }
    }

    async showMigrationGuild() {
        const descEl = this.contentEl.createDiv();

        await MarkdownRenderer.render(this.app,
            `# Migration from version 1

Among many improvements that Math Booster v2 introduces is a new format for theorem callouts, which is

- **More keyboard-friendly** (though you can insert one using a modal as before)
- **Less plugin-dependent**

than the old format used in v1.

##### Automatically numbered

\`\`\`md
> [!theorem] Cauchy-Schwarz inequality
> Let $x, y \\in \\R^n$. Then, ...
\`\`\`

##### Manually numbered

\`\`\`md
> [!theorem|1.2] Cauchy-Schwarz inequality
> Let $x, y \\in \\R^n$. Then, ...
\`\`\`

##### Without number

\`\`\`md
> [!theorem|*] Cauchy-Schwarz inequality
> Let $x, y \\in \\R^n$. Then, ...
\`\`\`


To fully enjoy Math Booster v2, click the button below to convert the old format to the new one. Alternatively, you can do it later by running the command **Migrate from version 1**.
`, descEl, '', this.component);
        descEl.querySelectorAll('.copy-code-button').forEach((el) => el.remove());

        new Setting(this.contentEl)
            .addButton((button) => {
                button.setButtonText('Convert')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        new MigrationModal(this.plugin).open();
                    })
            })
            .addButton((button) => button.setButtonText('Not now').onClick(() => this.close()))
    }

    onClose() {
        this.contentEl.empty();
        this.component.unload();
    }
}


export class MigrationModal extends Modal {
    component: Component;

    constructor(public plugin: MathBooster) {
        super(plugin.app);
        this.component = new Component();
        this.plugin.addChild(this.component);
    }

    async onOpen() {
        let { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        modalEl.querySelector('.modal-close-button')?.remove();
        titleEl.setText("Convert theorem callouts' format from v1 to v2")

        const descEl = contentEl.createDiv();
        await MarkdownRenderer.render(
            this.app,
            `
In order to enjoy Math Booster v2, you need to convert the old format:

\`\`\`md
> [!math|{"type":"theorem","number":"auto","title":"Main result","label":"main-result","_index":0}] Theorem 1 (Main result).
\`\`\`

to the new format:

\`\`\`md
> [!theorem] Main result
> %% label: main-result %%
\`\`\`

> [!WARNING] 
> **MAKE SURE YOU HAVE A BACKUP OF YOUR VAULT BEFORE CONTINUING. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DAMAGES OR OTHER LIABILITY ARISING FROM THIS OPERATION.**
`,
            descEl, '', this.component);
        descEl.querySelectorAll('.copy-code-button').forEach(el => el.remove());

        await new Promise<void>((resolve) => {
            new Setting(contentEl)
                .setName('Are you sure to proceed?')
                .addButton((button) => {
                    button.setButtonText('Yes').setWarning().onClick(() => resolve())
                })
                .addButton((button) => {
                    button.setButtonText('No').onClick(() => this.close())
                });
        });

        // @ts-ignore
        if (!this.app.metadataCache.initialized || !this.plugin.indexManager.initialized) {
            new Notice('Obsidian is still indexing the vault. Try again after the cache is fully initialized.');
            return;
        }

        contentEl.empty();

        const waitForCacheRefresh = new Setting(contentEl)
            .setName('Preparing the fresh cache...')
        // .then(setting => setting.controlEl.style.width = '50%');
        await new Promise<void>((resolve) => {
            waitForCacheRefresh.addProgressBar((bar) => {
                let progress = 0;
                const timer = window.setInterval(() => {
                    bar.setValue(progress++)
                    if (progress >= 100) {
                        window.clearInterval(timer);
                        resolve();
                    }
                }, 3 * 10);
            })
        });
        waitForCacheRefresh.setName('Preparing the fresh cache... Done!');

        const converting = new Setting(contentEl)
            .setName('Converting...')
        // .then(setting => setting.controlEl.style.width = '50px');
        await new Promise<void>((resolve) => {
            converting.addProgressBar(async (bar) => {
                const files = this.app.vault.getMarkdownFiles();
                let done = 0;
                const all = files.length;
                for (const file of files) {
                    await rewriteTheoremCalloutFromV1ToV2(this.plugin, file);
                    bar.setValue(done++ / all * 100);
                }
                bar.setValue(100);
                resolve();
            })
        });
        converting.setName('Converting... Done!');

        new Setting(contentEl)
            .addButton((button) => {
                button.setButtonText('Close')
                    .setCta()
                    .onClick(() => this.close())
            })
    }

    onClose() {
        this.contentEl.empty();
        this.component.unload();
    }

}