import { Modal, Setting, Component, MarkdownRenderer, Notice } from "obsidian";

import LatexReferencer from "main";
import { isPluginOlderThan } from "utils/obsidian";
import { rewriteTheoremCalloutFromV1ToV2 } from "utils/plugin";


export class PluginSplitNoticeModal extends Modal {
    component: Component;

    constructor(public plugin: LatexReferencer) {
        super(plugin.app);
        this.component = new Component();
    }

    onOpen() {
        const { app, plugin, contentEl, titleEl } = this;
        plugin.addChild(this.component);
        contentEl.empty();

        titleEl.setText(`${plugin.manifest.name} ver. ${plugin.manifest.version}`);

        new Setting(contentEl)
            .setName('Some features of this plugin have been rewritten with a bunch of improvements, and they are now available as the following separate plugins:')
            .setHeading();

        for (const { name, id, desc } of [
            {
                name: 'Better Math in Callouts & Blockquotes',
                id: 'math-in-callout',
                desc: 'Add better Live Preview support for math rendering inside callouts & blockquotes. It renders math expressions in callouts and provides appropriate handling of multi-line equations inside blockquotes.'
            },
            {
                name: 'Rendered Block Link Suggestions',
                id: 'rendered-block-link-suggestions',
                desc: 'Render equations and other types of blocks in Obsidian\'s built-in link suggestions'
            }
        ]) {
            const installed = id in (app.plugins as any).manifests;
            const enabled = app.plugins.enabledPlugins.has(id);

            new Setting(contentEl)
                .setName(name)
                .setDesc(desc)
                .addButton((button) => {
                    button
                        .setButtonText(enabled ? 'Already enabled!' : installed ? 'Enable' : 'Install')
                        .then((button) => enabled || button.setCta())
                        .onClick(() => {
                            self.open(`obsidian://show-plugin?id=${id}`);
                            this.component.registerDomEvent(window, 'click', (evt) => {
                                this.onOpen();
                            })
                        });
                })
        }
    }

    onClose() {
        this.contentEl.empty();
        this.component.unload();
    }
}

export class RenameNoticeModal extends Modal {
    component: Component;

    constructor(public plugin: LatexReferencer) {
        super(plugin.app);
        this.component = new Component();
    }

    onOpen() {
        this.plugin.addChild(this.component)

        const { contentEl, titleEl } = this;
        contentEl.empty();

        titleEl.setText('Math Booster has been renamed');

        MarkdownRenderer.render(
            this.app,
            `Starting from version 2.2.0, Math Booster has been renamed to ***LaTeX-like Theorem & Equation Referencer*** for better clarity and discoverability.\n\nWhile the display name in the community plugin browser may still reflect the previous version, it will be updated shortly.\n\nA big thank you for those who shared their ideas [here](https://github.com/RyotaUshio/obsidian-math-booster/issues/210)!\n\n> [!warning]\n> If you have custom CSS snippets with CSS classes <code>.math-booster-&#42</code>, don't worry, they still work!\n> \n> But I do recommend you to replace them with <code>.latex-referencer-&#42</code> as the old class names might be removed in the future.`,
            contentEl,
            '',
            this.component
        );

        new Setting(contentEl)
            .addButton((button) => {
                button.setCta()
                    .setButtonText('Okay, I got it')
                    .onClick(() => this.close());
            })
            .then((setting) => setting.settingEl.style.border = 'none');
    }

    onClose() {
        this.contentEl.empty();
        this.component.unload();
    }
}


export class DependencyNotificationModal extends Modal {
    component: Component;

    constructor(public plugin: LatexReferencer, public dependenciesOK: boolean, public v1: boolean) {
        super(plugin.app);
        this.component = new Component();
    }

    async onOpen() {
        this.plugin.addChild(this.component);

        const { contentEl, titleEl } = this;
        contentEl.empty();

        titleEl.setText(`${this.plugin.manifest.name} ${this.plugin.manifest.version}`)

        if (!this.dependenciesOK) this.showDependencies();

        if (this.v1) this.showMigrationGuild();
    }

    showDependencies() {
        this.contentEl.createDiv({
            text: `${this.plugin.manifest.name} requires the following plugin to work properly.`,
            attr: { style: "margin-bottom: 1em;" }
        });

        /**
         * Validity indicator was taken from the Latex Suite plugin (https://github.com/artisticat1/obsidian-latex-suite/blob/a5914c70c16d5763a182ec51d9716110b40965cf/src/settings.ts)
         * 
         * MIT License
         * 
         * Copyright (c) 2022 artisticat1
         * 
         * Permission is hereby granted, free of charge, to any person obtaining a copy
         * of this software and associated documentation files (the "Software"), to deal
         * in the Software without restriction, including without limitation the rights
         * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
         * copies of the Software, and to permit persons to whom the Software is
         * furnished to do so, subject to the following conditions:
         * 
         * The above copyright notice and this permission notice shall be included in all
         * copies or substantial portions of the Software.
         * 
         * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
         * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
         * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
         * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
         * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
         * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
         * SOFTWARE.
         */
        for (const depenedency of Object.values(this.plugin.dependencies)) {
            const depPlugin = this.app.plugins.getPlugin(depenedency.id);
            const isValid = depPlugin && !isPluginOlderThan(depPlugin, depenedency.version);
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
                        `Required version: ${depenedency.version}+ / `
                        + (depPlugin ? `Currently installed: ${depPlugin.manifest.version}`
                            : `Not installed or enabled`)
                }
            );
        }
    }

    async showMigrationGuild() {
        this.contentEl.createEl('h3', { text: "Migration from version 1" });

        MarkdownRenderer.render(
            this.app,
            `LaTeX-like Theorem & Equation Referencer (formerly called Math Booster) version 2 introduces a [new format for theorem callouts](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/theorem-callouts/theorem-callouts.html). 

To fully enjoy version 2, click the button below to convert the old theorem format to the new one. Alternatively, you can do it later by running the command "Migrate from version 1".`,
            this.contentEl.createDiv(),
            '',
            this.component
        );

        new Setting(this.contentEl)
            .addButton((button) => {
                button.setButtonText('Convert')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        new MigrationModal(this.plugin).open();
                    })
            })
            .addButton((button) => button.setButtonText('Not now')
                .onClick(() => this.close()))
            .then(setting => setting.settingEl.style.border = 'none');




        const descEl = this.contentEl.createDiv({ cls: 'math-booster-version-2-release-note-modal' });

        await MarkdownRenderer.render(this.app,
            `### What's new in version 2

- [New format for theorem callouts](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/theorem-callouts/theorem-callouts.html):
    -   *much cleaner*,
    -   *more intuitive*,
    -   *more keyboard-friendly*,
    -   and *less plugin-dependent* than the previous format
-   New indexing mechanism:
    -   no longer blocks UI
    -   no longer hard-codes theorem indices in notes directly
-   [Enhancing Obsidian's built-in link autocomplete](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/search-&-link-autocomplete/enhancing-obsidian's-built-in-link-autocomplete.html): now equations are rendered in the built-in autocomplete as well.
-   [Custom link autocomplete](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/search-&-link-autocomplete/custom-link-autocomplete.html) improvements: filter theorems & equations (*entire vault/recent notes/active note*)
-   [Search modal](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/search-&-link-autocomplete/search-modal.html): more control & flexibility than editor autocomplete, including *Dataview queries*
-   Adding metadata to [theorems](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/theorem-callouts/theorem-callouts.html) and [equations](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/equations.html) with comments
- Theorem numbers and [equation numbers](https://ryotaushio.github.io/obsidian-latex-theorem-equation-referencer/equations.html) now can be displayed *almost everywhere*:
        
##### Version 1:

|                    | Theorem number | Equation number |
| ------------------ | -------------- | --------------- |
| Reading view       |       ✅       |        ✅       |
| Live preview       |       ✅       |        ✅       |
| Embeds             |       ✅       |                 |
| Hover page preview |       ✅       |                 |
| PDF export         |       ✅       |                 |
 
##### **🎉 Version 2:**

|                    | Theorem number | Equation number |
| ------------------ | -------------- | --------------- |
| Reading view       |       ✅       |         ✅       |
| Live preview       |       ✅       |         ✅       |
| Embeds             |       ✅       |         ✅       |
| Hover page preview |       ✅       |         ✅       |
| PDF export         |       ✅       |         ✅       |

### No longer supported

- ["Show backlinks" right-click menu](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer/blob/1.0.4/docs/backlinks.md)
    - Use [Strange New Worlds](https://github.com/TfTHacker/obsidian42-strange-new-worlds) instead.
- [Projects](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer/blob/1.0.4/docs/projects.md)
    - might be supported later with some improvements

`, descEl, '', this.component);
        descEl.querySelectorAll('.copy-code-button').forEach((el) => el.remove());
    }

    onClose() {
        this.contentEl.empty();
        this.component.unload();
    }
}


export class MigrationModal extends Modal {
    component: Component;

    constructor(public plugin: LatexReferencer) {
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
In order to enjoy LaTeX-like Theorem & Equation Referencer, you need to convert the old theorem format from Math Booster version 1:

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
            .setName('Preparing the fresh cache...');
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