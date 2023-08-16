import { App, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, SectionCache, MarkdownSectionInformation, TFile } from "obsidian";
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

import MathBooster from './main';
import { getMathCache, getMathCacheFromPos, resolveSettings } from './utils';
import { ActiveNoteIndexer, AutoNoteIndexer, NonActiveNoteIndexer } from './indexer';


/** For reading mode */

export class DisplayMathRenderChild extends MarkdownRenderChild {
    file: TFile;
    id: string | undefined;

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, public context: MarkdownPostProcessorContext) {
        // containerEl, currentEL are mjx-container.MathJax elements
        super(containerEl);
        const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
        if (file instanceof TFile) {
            this.file = file;
        }
    }

    setId() {
        if (this.id === undefined) {
            const info = this.getInfo();
            const cache = this.getCache();
            if (cache && info) {
                const mathCache = getMathCache(cache, info.lineStart);
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
        (new AutoNoteIndexer(this.app, this.plugin, this.file)).run();
    }

    async impl(indexer: ActiveNoteIndexer | NonActiveNoteIndexer) {
        this.setId();
        if (this.id) {
            const mathLink = indexer.mathLinkBlocks[this.id];
            const text = await indexer.getBlockText(this.id);
            if (text) {
                const settings = resolveSettings(undefined, this.plugin, this.file);
                if (this.containerEl) {
                    const el = replaceMathTag(this.containerEl, text, mathLink, settings.lineByLine);
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
            const indexer = new ActiveNoteIndexer(app, plugin, markdownView);
            this.callback(view, indexer);
        }

        async callback(view: EditorView, indexer: ActiveNoteIndexer) {
            const mjxElements = view.contentDOM.querySelectorAll<HTMLElement>('mjx-container.MathJax > mjx-math[display="true"]');
            const cache = app.metadataCache.getFileCache(indexer.file);
            const path = markdownView.file?.path;
            if (mjxElements && cache) {
                for (let i = 0; i < mjxElements.length; i++) {
                    const mjxContainerEl = mjxElements[i].parentElement;
                    if (mjxContainerEl) {
                        try {
                            const pos = view.posAtDOM(mjxContainerEl);
                            const id = getMathCacheFromPos(cache, pos)?.id;
                            if (id) {
                                const mathLink = plugin.getMathLinksAPI()?.get(path, id);
                                const text = await indexer.getBlockText(id);
                                if (text) {
                                    const settings = resolveSettings(undefined, plugin, markdownView.file);	
                                    replaceMathTag(mjxContainerEl, text, mathLink, settings.lineByLine);
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


export function getMathText(view: EditorView, mathCache: SectionCache) {
    const from = mathCache.position.start.offset;
    const to = mathCache.position.end.offset;
    const text = view.state.sliceDoc(from, to);
    return text;
}


export function getMathTextWithTag(text: string, tag: string | undefined, lineByLine?: boolean): string | undefined {
    const textResult = text.match(/^\$\$([\s\S]*)\$\$/);
    if (tag) {
        const tagResult = tag.match(/^\((.*)\)$/);
        if (textResult && tagResult) {
            const textContent = textResult[1];
            const tagContent = tagResult[1];
            return insertTagInMathText(textContent, tagContent, lineByLine);
        }
    }
    return textResult?.[1];
}

export function insertTagInMathText(textContent: string, tagContent: string, lineByLine?: boolean): string {
    if (lineByLine) {
        const alignResult = textContent.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
        if (alignResult) {
            let taggedText = "";
            let index = 1;
            for (const line of alignResult[1].split("\\\\")) {
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
    const tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }
    const taggedText = getMathTextWithTag(text, tag, lineByLine);
    if (taggedText) {
        const mjxContainerEl = renderMath(taggedText, true);
        finishRenderMath();
        displayMathEl.replaceWith(mjxContainerEl);
        return mjxContainerEl;
    }
}
