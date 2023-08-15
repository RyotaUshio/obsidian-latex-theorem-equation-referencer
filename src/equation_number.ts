import { App, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, SectionCache, MarkdownSectionInformation, TFile } from "obsidian";
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

import MathBooster from './main';
import { getMathCache, getMathCacheFromPos, resolveSettings } from './utils';
import { ActiveNoteIndexer, NonActiveNoteIndexer } from './indexer';
import { MathContextSettings } from "settings/settings";


/** For reading mode */

export class DisplayMathRenderChild extends MarkdownRenderChild {
    file: TFile;
    id: string | undefined;

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, public context: MarkdownPostProcessorContext) {
        // containerEl, currentEL are mjx-container.MathJax elements
        super(containerEl);
        let file = this.app.vault.getAbstractFileByPath(context.sourcePath);
        if (file instanceof TFile) {
            this.file = file;
        }
    }

    setId() {
        if (this.id === undefined) {
            let info = this.getInfo();
            let cache = this.getCache();
            if (cache && info) {
                let mathCache = getMathCache(cache, info.lineStart);
                if (mathCache && mathCache.id) {
                    this.id = mathCache.id;
                }
            }
        }
    }

    getCache(): CachedMetadata | null {
        return this.app.metadataCache.getCache(this.context.sourcePath);
    }

    getInfo(): MarkdownSectionInformation | null {
        return this.context.getSectionInfo(this.containerEl);
    }

    onload(): void {
        this.plugin.registerEvent(
            this.app.metadataCache.on(
                "math-booster:index-updated",
                (indexer) => this.impl(indexer)
            )
        );
    }

    async impl(indexer: ActiveNoteIndexer | NonActiveNoteIndexer) {
        this.setId();
        if (this.id) {
            let mathLink = indexer.mathLinkBlocks[this.id];
            let text = await indexer.getBlockText(this.id);
            if (text) {
                let settings = resolveSettings(undefined, this.plugin, this.file);
                if (this.containerEl) {
                    let el = replaceMathTag(this.containerEl, text, mathLink, Boolean(settings.lineByLine));
                    if (el) {
                        this.containerEl = el;
                    }
                }
            }
        }
    }
}


/** For live preview */

export function buildEquationNumberPlugin<V extends PluginValue>(app: App, plugin: MathBooster, markdownView: MarkdownView): ViewPlugin<V> {

    return ViewPlugin.fromClass(class implements PluginValue {
        constructor(view: EditorView) {
            // plugin.registerEvent(
            //     app.metadataCache.on(
            //         "math-booster:index-updated",
            //         (indexer) => {
            //             if (indexer instanceof ActiveNoteIndexer) {
            //                 this.callback(view, indexer);
            //             }
            //         }
            //     )
            // );
            this.impl(view);
        }

        update(update: ViewUpdate) {
            this.impl(update.view);
        }

        impl(view: EditorView) {
            let indexer = new ActiveNoteIndexer(app, plugin, markdownView);
            this.callback(view, indexer);
        }

        async callback(view: EditorView, indexer: ActiveNoteIndexer) {
            let mjxElements = view.contentDOM.querySelectorAll<HTMLElement>('mjx-container.MathJax > mjx-math[display="true"]');
            let cache = app.metadataCache.getFileCache(indexer.file);
            let path = markdownView.file?.path;
            if (mjxElements && cache) {
                for (let i = 0; i < mjxElements.length; i++) {
                    let mjxContainerEl = mjxElements[i].parentElement;
                    if (mjxContainerEl) {
                        try {
                            let pos = view.posAtDOM(mjxContainerEl);
                            let id = getMathCacheFromPos(cache, pos)?.id;
                            if (id) {
                                let mathLink = plugin.getMathLinksAPI()?.get(path, id);
                                let text = await indexer.getBlockText(id);
                                if (text) {
                                    const settings = resolveSettings(undefined, plugin, markdownView.file);	
                                    replaceMathTag(mjxContainerEl, text, mathLink, Boolean(settings.lineByLine));
                                }
                            }
                        } catch (err) {
                            // try it again later
                        }
                    }
                }
            }
        }

        destroy() { }
    });
}


function getTagEl(displayMathEl: HTMLElement): HTMLElement | null {
    // displayMathEl: HTMLElement selected by 'mjx-container.MathJax mjx-math[display="true"]'
    return displayMathEl.querySelector<HTMLElement>("mjx-mtext.mjx-n");
}


export function getMathText(view: EditorView, mathCache: SectionCache) {
    let from = mathCache.position.start.offset;
    let to = mathCache.position.end.offset;
    let text = view.state.sliceDoc(from, to);
    return text;
}


export function getMathTextWithTag(text: string, tag: string | undefined, lineByLine?: boolean): string | undefined {
    let textResult = text.match(/^\$\$([\s\S]*)\$\$/);
    if (tag) {
        let tagResult = tag.match(/^\((.*)\)$/);
        if (textResult && tagResult) {
            let textContent = textResult[1];
            let tagContent = tagResult[1];
            return insertTagInMathText(textContent, tagContent, lineByLine);
        }
    }
    return textResult?.[1];
}

export function insertTagInMathText(textContent: string, tagContent: string, lineByLine?: boolean): string {
    if (lineByLine) {
        let alignResult = textContent.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
        if (alignResult) {
            let taggedText = "";
            let index = 1;
            for (let line of alignResult[1].split("\\\\")) {
                if (line.trim()) {
                    taggedText += line.contains("\\nonumber") ?
                        line :
                        line.trim() + `\\tag{${tagContent}-${index++}}`;
                    taggedText += "\\\\";
                }
            }
            return "\\begin{align}" + taggedText + "\\end{align}";
        }
    }
    return textContent.replace(/[\n\r]/g, ' ') + `\\tag{${tagContent}}`;

}

export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string | undefined, lineByLine: boolean) {
    let tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }
    let taggedText = getMathTextWithTag(text, tag, lineByLine);
    if (taggedText) {
        let mjxContainerEl = renderMath(taggedText, true);
        finishRenderMath();
        displayMathEl.replaceWith(mjxContainerEl);
        return mjxContainerEl;
    }
}
