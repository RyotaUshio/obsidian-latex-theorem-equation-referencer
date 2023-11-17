import { App, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, CachedMetadata, MarkdownSectionInformation, TFile, editorInfoField, Menu, MarkdownView } from "obsidian";
import { StateEffect } from '@codemirror/state';
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

import MathBooster from './main';
import { 
    // getBacklinks, getMathCache, getSectionCacheFromMouseEvent, getSectionCacheOfDOM, 
    resolveSettings 
} from './utils/plugin';
import { MathContextSettings } from "./settings/settings";
// import { Backlink, BacklinkModal } from "./backlinks";
import { EquationBlock, MarkdownPage } from "./index/typings/markdown";
import { MathIndex } from "index";
import { parseLatexComment } from "utils/parse";


/** For reading view */

export const equationNumberProcessor = (plugin: MathBooster) => async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const isPdfExport = el.classList.contains('markdown-rendered');
    const sourceFile = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(sourceFile instanceof TFile)) return;
    const mjxContainerElements = el.querySelectorAll<HTMLElement>('mjx-container.MathJax[display="true"]');
    for (const mjxContainerEl of mjxContainerElements) {
        ctx.addChild(
            new DisplayMathRenderChild(mjxContainerEl, plugin.app, plugin, sourceFile, ctx, isPdfExport)
        );
    }
}

export class DisplayMathRenderChild extends MarkdownRenderChild {
    index: MathIndex;

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, public file: TFile, public context: MarkdownPostProcessorContext, public isPdfExport: boolean) {
        // containerEl, currentEL are mjx-container.MathJax elements
        super(containerEl);
        this.index = this.plugin.indexManager.index;

        this.registerEvent(this.app.metadataCache.on("math-booster:index-updated", (file) => {
            if (file == this.file) this.update()
        }));
    }

    getEquationCache(): EquationBlock | null {
        const info = this.context.getSectionInfo(this.containerEl);
        const page = this.index.load(this.file.path);
        if (!info || !MarkdownPage.isMarkdownPage(page)) return null;

        // get block ID
        const block = page.getBlockByLineNumber(info.lineStart) ?? page.getBlockByLineNumber(info.lineEnd);
        const id = block?.$blockId;

        // get IndexItem from block ID
        if (id) {
            const page = this.plugin.indexManager.index.load(this.file.path);
            if (!MarkdownPage.isMarkdownPage(page)) return null
            const block = page.$blocks.get(id);
            if (EquationBlock.isEquationBlock(block)) return block;
        }

        return null;
    }

    onload(): void {
        this.update();
    }

    update() {
        /**
         * https://github.com/RyotaUshio/obsidian-math-booster/issues/179
         * 
         * In the case of embeds or hover popovers, the line numbers contained 
         * in the result of MarkdownPostProcessorContext.getSectionInfo() is 
         * relative to the content included in the embed.
         * In other words, they does not always represent the offset from the beginning of the file.
         * For this reason, DisplayMathRenderChild.setId() doesn't work properly for embeds or hover popovers,
         * and we have to exclude them from the target of DisplayMathRenderChild.
         */
        let equation: EquationBlock | null = null;
        const hover = this.containerEl.closest('.popover.hover-popover');
        const embedSrc = this.containerEl.closest('[src]')?.getAttribute('src');

        if (hover) return; // ignore HoverPopover

        if (embedSrc) {
            // ignore embeds
            // TODO: support embeds! theorem callouts are already supported so it should be possible
            return;
        }

        equation = equation ?? this.getEquationCache();

        if (!equation) return;

        const settings = resolveSettings(undefined, this.plugin, this.file);
        replaceMathTag(this.containerEl, equation.$mathText, equation.$printName, settings);
        // this.registerDomEvent(
        //     this.containerEl, "contextmenu", (event) => {
        //         const menu = new Menu();

        //         // Show backlinks
        //         menu.addItem((item) => {
        //             item.setTitle("Show backlinks");
        //             item.onClick((clickEvent) => {
        //                 if (clickEvent instanceof MouseEvent) {
        //                     const backlinks = this.getBacklinks(event);
        //                     new BacklinkModal(this.app, this.plugin, backlinks).open();
        //                 }
        //             })
        //         });
        //         menu.showAtMouseEvent(event);
        //     }
        // );
    }

    // getBacklinks(event: MouseEvent): Backlink[] | null {
    //     const cache = this.app.metadataCache.getFileCache(this.file);
    //     if (!cache) return null;

    //     const info = this.context.getSectionInfo(this.containerEl);
    //     let lineNumber = info?.lineStart;
    //     if (typeof lineNumber !== "number") return null;

    //     return getBacklinks(this.app, this.plugin, this.file, cache, (block) => block.position.start.line == lineNumber);
    // }
}


/** For live preview */

export function buildEquationNumberPlugin<V extends PluginValue>(plugin: MathBooster): ViewPlugin<V> {

    const { app, indexManager: { index } } = plugin;

    const forceUpdateEffect = StateEffect.define<null>();

    plugin.registerEvent(app.metadataCache.on('math-booster:index-updated', (file) => {
        // const page = index.load(file.path);
        // if (!(page instanceof MarkdownPage)) return;
        // const backlinks = index.getBacklinks(page);
        app.workspace.iterateAllLeaves((leaf) => {
            if (
                leaf.view instanceof MarkdownView
                && leaf.view.getMode() === 'source'
                // && backlinks.has(leaf.view.file.path) // TODO: auto-register file link from block link so that we can get backlinks properly
            ) {
                leaf.view.editor.cm?.dispatch({ effects: forceUpdateEffect.of(null) });
            }
        });
    }));

    return ViewPlugin.fromClass(class implements PluginValue {
        constructor(view: EditorView) {
            this.impl(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.transactions.some(tr => tr.effects.some(effect => effect.is(forceUpdateEffect)))) {
                this.impl(update.view);
            }
        }

        impl(view: EditorView) {
            const info = view.state.field(editorInfoField);
            if (info.file) {
                this.callback(view, info.file);
            }
        }

        async callback(view: EditorView, file: TFile) {
            const mjxContainerElements = view.contentDOM.querySelectorAll<HTMLElement>('mjx-container.MathJax[display="true"]');
            const settings = resolveSettings(undefined, plugin, file);
            const page = plugin.indexManager.index.load(file.path);
            if (!MarkdownPage.isMarkdownPage(page)) return;

            for (const mjxContainerEl of mjxContainerElements) {
                try {
                    const pos = view.posAtDOM(mjxContainerEl);
                    const line = view.state.doc.lineAt(pos).number - 1;
                    const block = page.getBlockByLineNumber(line);
                    if (!(block instanceof EquationBlock)) return;

                    replaceMathTag(mjxContainerEl, block.$mathText, block.$printName, settings);
                    // plugin.registerDomEvent(
                    //     mjxContainerEl, "contextmenu", (event) => {
                    //         const menu = new Menu();

                    //         // Show backlinks
                    //         menu.addItem((item) => {
                    //             item.setTitle("Show backlinks");
                    //             item.onClick((clickEvent) => {
                    //                 if (clickEvent instanceof MouseEvent) {
                    //                     const backlinks = this.getBacklinks(mjxContainerEl, event, file, view);
                    //                     new BacklinkModal(app, plugin, backlinks).open();
                    //                 }
                    //             })
                    //         });

                    //         menu.showAtMouseEvent(event);
                    //     }
                    // );

                } catch (err) {
                    // try it again later
                }
            }


        }

        destroy() { }

        // getBacklinks(mjxContainerEl: HTMLElement, event: MouseEvent, file: TFile, view: EditorView): Backlink[] | null {
        //     const cache = app.metadataCache.getFileCache(file);
        //     if (!cache) return null;

        //     const sec = getSectionCacheOfDOM(mjxContainerEl, "math", view, cache) ?? getSectionCacheFromMouseEvent(event, "math", view, cache);
        //     if (sec === undefined) return null;

        //     return getBacklinks(app, plugin, file, cache, (block) =>
        //         block.position.start.line == sec.position.start.line || block.position.end.line == sec.position.end.line || block.id == sec.id
        //     );
        // }
    });
}

export function getMathTextWithTag(text: string, tag: string | null, lineByLine?: boolean): string | undefined {
    if (tag !== null) {
        const tagResult = tag.match(/^\((.*)\)$/);
        if (tagResult) {
            const tagContent = tagResult[1];
            return insertTagInMathText(text, tagContent, lineByLine);
        }
    }
    return text;
}

export function insertTagInMathText(text: string, tagContent: string, lineByLine?: boolean): string {
    if (lineByLine) {
        const alignResult = text.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
        if (alignResult) {
            // remove comments
            let alignContent = alignResult[1]
                .split('\n')
                .map(line => parseLatexComment(line).nonComment)
                .join('\n');
            // add tags
            let index = 1;
            alignContent = alignContent
                .split("\\\\")
                .map(alignLine => (!alignLine.trim() || alignLine.contains("\\nonumber"))
                    ? alignLine
                    : (alignLine + `\\tag{${tagContent}-${index++}}`)
                ).join("\\\\");
            return "\\begin{align}" + alignContent + "\\end{align}";
        }
    }
    return text + `\\tag{${tagContent}}`;
}


export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string | null, settings: Required<MathContextSettings>) {
    const tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }
    const taggedText = getMathTextWithTag(text, tag, settings.lineByLine);
    if (taggedText) {
        const mjxContainerEl = renderMath(taggedText, true);
        displayMathEl.replaceChildren(...mjxContainerEl.childNodes);
        finishRenderMath();
    }
}
