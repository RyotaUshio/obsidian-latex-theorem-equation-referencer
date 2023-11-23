/**
 * Display equation numbers in reading view, embeds, hover page preview, and PDF export.
 */

import { App, MarkdownRenderChild, finishRenderMath, MarkdownPostProcessorContext, TFile, Notice } from "obsidian";

import MathBooster from 'main';
import { resolveSettings } from 'utils/plugin';
import { EquationBlock, MarkdownPage } from "index/typings/markdown";
import { MathIndex } from "index";
import { isPdfExport, resolveLinktext } from "utils/obsidian";
import { replaceMathTag } from "./common";


export const createEquationNumberProcessor = (plugin: MathBooster) => async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    if (isPdfExport(el)) preprocessForPdfExport(plugin, el, ctx);

    const sourceFile = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(sourceFile instanceof TFile)) return;

    const mjxContainerElements = el.querySelectorAll<HTMLElement>('mjx-container.MathJax[display="true"]');
    for (const mjxContainerEl of mjxContainerElements) {
        ctx.addChild(
            new EquationNumberRenderer(mjxContainerEl, plugin, sourceFile, ctx)
        );
    }
    finishRenderMath();
}


/** 
 * As a preprocessing for displaying equation numbers in the exported PDF, 
 * add an attribute representing a block ID to each numbered equation element
 * so that EquationNumberRenderer can find the corresponding block from the index
 * without relying on the line number.
 */
function preprocessForPdfExport(plugin: MathBooster, el: HTMLElement, ctx: MarkdownPostProcessorContext) {

    try {
        const topLevelMathDivs = el.querySelectorAll<HTMLElement>(':scope > div.math.math-block > mjx-container.MathJax[display="true"]');

        const page = plugin.indexManager.index.load(ctx.sourcePath);
        if (!MarkdownPage.isMarkdownPage(page)) {
            new Notice(`${plugin.manifest.name}: Failed to fetch the metadata for PDF export; equation numbers will not be displayed in the exported PDF.`);
            return;
        }

        let equationIndex = 0;
        for (const section of page.$sections) {
            for (const block of section.$blocks) {
                if (!EquationBlock.isEquationBlock(block)) continue;

                const div = topLevelMathDivs[equationIndex++];
                if (block.$printName && block.$blockId) div.setAttribute('data-equation-block-id', block.$blockId);
            }
        }

        if (topLevelMathDivs.length != equationIndex) {
            new Notice(`${plugin.manifest.name}: Something unexpected occured while preprocessing for PDF export. Equation numbers might not be displayed properly in the exported PDF.`);
        }
    } catch (err) {
        new Notice(`${plugin.manifest.name}: Something unexpected occured while preprocessing for PDF export. See the developer console for the details. Equation numbers might not be displayed properly in the exported PDF.`);
        console.error(err);
    }
}


export class EquationNumberRenderer extends MarkdownRenderChild {
    app: App
    index: MathIndex;

    constructor(containerEl: HTMLElement, public plugin: MathBooster, public file: TFile, public context: MarkdownPostProcessorContext) {
        // containerEl, currentEL are mjx-container.MathJax elements
        super(containerEl);
        this.app = plugin.app;
        this.index = this.plugin.indexManager.index;

        this.registerEvent(this.plugin.indexManager.on("index-initialized", () => {
            setTimeout(() => this.update());
        }));
    
        this.registerEvent(this.plugin.indexManager.on("index-updated", (file) => {
            setTimeout(() => {
                if (file.path === this.file.path) this.update();
            });
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
        if (id) return this.getEquationCacheFromId(id);

        return null;
    }

    getEquationCacheFromId(id: string): EquationBlock | null {
        const page = this.plugin.indexManager.index.load(this.file.path);
        if (!MarkdownPage.isMarkdownPage(page)) return null
        const block = page.$blocks.get(id);
        if (EquationBlock.isEquationBlock(block)) return block;
        return null;
    }

    async onload() {
        setTimeout(() => this.update());
    }

    onunload() {
        // I don't know if this is really necessary, but just in case...
        finishRenderMath();
    }

    update() {
        // for PDF export
        const id = this.containerEl.getAttribute('data-equation-block-id');

        const equation = id ? this.getEquationCacheFromId(id) : this.getEquationCacheCaringHoverAndEmbed();
        if (!equation) return;
        const settings = resolveSettings(undefined, this.plugin, this.file);
        replaceMathTag(this.containerEl, equation, settings);
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
