import { App, LinkCache, MarkdownRenderer, Modal, TFile } from 'obsidian';

import MathBooster from 'main';
import { LEAF_OPTION_TO_ARGS } from 'settings/settings';
import { getIO } from 'file_io';
import { openFileAndSelectPosition } from 'utils/obsidian';


export type Backlink = { sourcePath: string, link: LinkCache };

export interface BacklinkProvider {
    getBacklinks: () => Backlink[] | null;
}


export class BacklinkModal extends Modal {
    constructor(app: App, public plugin: MathBooster, public backlinks: Backlink[] | null, public showPrev: number = 1, public showNext: number = 1) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h3", {text: "Backlinks"});

        this.containerEl.querySelector<HTMLElement>("div.modal")?.addClass("math-booster-backlink-modal");

        if (this.backlinks) {
            if (this.backlinks.length) {
                contentEl.createDiv({text: "Click on an item to open it."})
                const list = contentEl.createEl("ul");
                for (const backlink of this.backlinks) {
                    const item = list.createEl("li");
                    this.renderBacklink(item, backlink);
                }
            } else {
                contentEl.createDiv({ text: "No backlink was found." })
            }
        } else {
            contentEl.createDiv({ text: "An error occured when searching backlinks." })
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }

    async renderBacklink(el: HTMLElement, backlink: Backlink) {
        const file = this.app.vault.getAbstractFileByPath(backlink.sourcePath);
        const cache = this.app.metadataCache.getCache(backlink.sourcePath);

        if (file instanceof TFile && cache?.sections) {
            const io = getIO(this.plugin, file);
            const index = cache.sections.findIndex((secCache) => {
                const { start: secStart, end: secEnd } = secCache.position;
                const { start: linkStart, end: linkEnd } = backlink.link.position;
                return secStart.offset <= linkStart.offset && linkEnd.offset <= secEnd.offset;
            });
            el.createEl("h6", {
                text: `${file.path.slice(0, - (file.extension.length + 1))}, line ${cache.sections[index].position.start.line + 1}`
            });

            if (index >= 0) {
                const content = await io.getRange({
                    start: cache.sections[Math.max(index - this.showPrev, 0)].position.start,
                    end: cache.sections[Math.min(index + this.showNext, cache.sections.length - 1)].position.end,
                });
                const previewEl = el.createDiv({ cls: "math-booster-backlink-preview" });
                MarkdownRenderer.renderMarkdown(content, previewEl, backlink.sourcePath, this.plugin);
            }

            this.plugin.registerDomEvent(
                el, "click", async () => {
                    this.close();
                    await openFileAndSelectPosition(this.app, file, backlink.link.position, ...LEAF_OPTION_TO_ARGS[this.plugin.extraSettings.backlinkLeafOption]);
                }
            );
        }
    }
}
