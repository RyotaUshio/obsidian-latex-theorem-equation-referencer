/**
 * Display equation numbers in reading view, embeds, hover page preview, and PDF export.
 */

import { App, MarkdownRenderChild, finishRenderMath, MarkdownPostProcessorContext, TFile } from "obsidian";

import MathBooster from 'main';
import { resolveSettings } from 'utils/plugin';
import { EquationBlock, MarkdownPage } from "index/typings/markdown";
import { MathIndex } from "index";
import { resolveLinktext } from "utils/obsidian";
import { replaceMathTag } from "./common";


export const createEquationNumberProcessor = (plugin: MathBooster) => async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const sourceFile = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(sourceFile instanceof TFile)) return;
    const mjxContainerElements = el.querySelectorAll<HTMLElement>('mjx-container.MathJax[display="true"]');
    for (const mjxContainerEl of mjxContainerElements) {
        ctx.addChild(
            new EquationNumberRenderer(mjxContainerEl, plugin.app, plugin, sourceFile, ctx)
        );
    }
}

export class EquationNumberRenderer extends MarkdownRenderChild {
    index: MathIndex;

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, public file: TFile, public context: MarkdownPostProcessorContext) {
        // containerEl, currentEL are mjx-container.MathJax elements
        super(containerEl);
        this.index = this.plugin.indexManager.index;

        this.registerEvent(this.app.metadataCache.on("math-booster:index-updated", (file) => {
            if (file.path === this.file.path) this.update();
        }));
    }

    getEquationCache(lineOffset: number = 0): EquationBlock | null {
        const info = this.context.getSectionInfo(this.containerEl);
        const page = this.index.load(this.file.path);
        if (!info || !MarkdownPage.isMarkdownPage(page)) return null;

        // get block ID
        const block = page.getBlockByLineNumber(info.lineStart + lineOffset) ?? page.getBlockByLineNumber(info.lineEnd + lineOffset);
        const id = block?.$blockId;

        // get EquationBlock from block ID
        if (id) {
            const page = this.plugin.indexManager.index.load(this.file.path);
            if (!MarkdownPage.isMarkdownPage(page)) return null
            const block = page.$blocks.get(id);
            if (EquationBlock.isEquationBlock(block)) return block;
        }

        return null;
    }

    async onload() {
        setTimeout(() => this.update());
    }

    onunload() {
        // I don't know when to call finishRenderMath...
        finishRenderMath();
    }

    update() {
        const equation = this.getEquationCacheCaringHoverAndEmbed();
        if (!equation) return;
        const settings = resolveSettings(undefined, this.plugin, this.file);
        replaceMathTag(this.containerEl, equation.$mathText, equation.$printName, settings);
    }

    getEquationCacheCaringHoverAndEmbed(): EquationBlock | null {
        /**
         * https://github.com/RyotaUshio/obsidian-math-booster/issues/179
         * 
         * In the case of embeds or hover popovers, the line numbers contained 
         * in the result of MarkdownPostProcessorContext.getSectionInfo() is 
         * relative to the content included in the embed.
         * In other words, they does not always represent the offset from the beginning of the file.
         * So they require special handling.
         */

        const equation = this.getEquationCache();

        let linktext = this.containerEl.closest('[src]')?.getAttribute('src'); // in the case of embeds

        if (!linktext) {
            const hoverEl = this.containerEl.closest<HTMLElement>('.hover-popover:not(.hover-editor)');
            if (hoverEl) {
                // The current context is hover page preview; read the linktext saved in the plugin instance.
                linktext = this.plugin.lastHoverLinktext;
            }
        }

        if (linktext) { // linktext was found
            const { file, subpathResult } = resolveLinktext(this.app, linktext, this.context.sourcePath) ?? {};

            if (!file || !subpathResult) return null;

            const page = this.index.load(file.path);
            if (!MarkdownPage.isMarkdownPage(page)) return null;

            if (subpathResult.type === "block") {
                const block = page.$blocks.get(subpathResult.block.id);
                if (!EquationBlock.isEquationBlock(block)) return null;
                return block;
            } else {
                return this.getEquationCache(subpathResult.start.line);
            }
        }

        return equation;
    }
}
