import { App, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, CachedMetadata, SectionCache, MarkdownSectionInformation, TFile, editorInfoField, Menu } from "obsidian";
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

import MathBooster from './main';
import { getBacklinks, getMathCache, getMathCacheFromPos, getSectionCacheFromMouseEvent, getSectionCacheOfDOM, resolveSettings } from './utils';
import { ActiveNoteIndexer, AutoNoteIndexer, NonActiveNoteIndexer } from './indexer';
import { MathContextSettings } from "./settings/settings";
import { ActiveNoteIO } from "./file_io";
import { Backlink, BacklinkModal } from "backlinks";


/** For reading view */

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
                (indexer) => {
                    if (indexer.file == this.file) {
                        this.impl(indexer)
                    }
                }
            )
        );
        (new AutoNoteIndexer(this.app, this.plugin, this.file)).run();

        this.plugin.registerDomEvent(
            this.containerEl, "contextmenu", (event) => {
                const menu = new Menu();

                // Show backlinks
                menu.addItem((item) => {
                    item.setTitle("Show backlinks");
                    item.onClick((clickEvent) => {
                        if (clickEvent instanceof MouseEvent) {
                            const backlinks = this.getBacklinks(event);
                            new BacklinkModal(this.app, this.plugin, backlinks).open();
                        }
                    })
                });

                menu.showAtMouseEvent(event);
            }
        );
    }

    async impl(indexer: ActiveNoteIndexer | NonActiveNoteIndexer) {
        this.setId();
        if (this.id) {
            const mathLink = indexer.mathLinkBlocks[this.id];
            const text = await indexer.io.getBlockText(this.id);
            if (text) {
                const settings = resolveSettings(undefined, this.plugin, this.file);
                if (this.containerEl) {
                    replaceMathTag(this.containerEl, text, mathLink, settings);
                }
            }
        }
    }

    getBacklinks(event: MouseEvent): Backlink[] | null {
        const cache = this.app.metadataCache.getFileCache(this.file);
        if (!cache) return null;

        const info = this.context.getSectionInfo(this.containerEl);
        let lineNumber = info?.lineStart;
        if (typeof lineNumber != "number") return null;

        return getBacklinks(this.app, this.plugin, this.file, cache, (block) => block.position.start.line == lineNumber);
    }
}


/** For live preview */

export function buildEquationNumberPlugin<V extends PluginValue>(plugin: MathBooster): ViewPlugin<V> {

    return ViewPlugin.fromClass(class implements PluginValue {
        constructor(view: EditorView) {
            this.impl(view);
        }

        update(update: ViewUpdate) {
            this.impl(update.view);
        }

        impl(view: EditorView) {
            const info = view.state.field(editorInfoField);
            if (info.file && info.editor) {
                const io = new ActiveNoteIO(plugin, info.file, info.editor);
                this.callback(view, io);
            }
        }

        async callback(view: EditorView, io: ActiveNoteIO) {
            const mjxElements = view.contentDOM.querySelectorAll<HTMLElement>('mjx-container.MathJax > mjx-math[display="true"]');
            const cache = app.metadataCache.getFileCache(io.file);
            if (mjxElements && cache) {
                for (let i = 0; i < mjxElements.length; i++) {
                    const mjxContainerEl = mjxElements[i].parentElement;
                    if (mjxContainerEl) {
                        try {
                            const pos = view.posAtDOM(mjxContainerEl);
                            const id = getMathCacheFromPos(cache, pos)?.id;

                            if (id) {
                                const mathLink = plugin.getMathLinksAPI()?.get(io.file.path, id);
                                const text = await io.getBlockText(id);
                                if (text) {
                                    const settings = resolveSettings(undefined, plugin, io.file);
                                    replaceMathTag(mjxContainerEl, text, mathLink, settings);
                                }
                            }
                        } catch (err) {
                            // try it again later
                        }

                        plugin.registerDomEvent(
                            mjxContainerEl, "contextmenu", (event) => {
                                const menu = new Menu();
                
                                // Show backlinks
                                menu.addItem((item) => {
                                    item.setTitle("Show backlinks");
                                    item.onClick((clickEvent) => {
                                        if (clickEvent instanceof MouseEvent) {
                                            const backlinks = this.getBacklinks(mjxContainerEl, event, io.file, view);
                                            new BacklinkModal(plugin.app, plugin, backlinks).open();
                                        }
                                    })
                                });
                
                                menu.showAtMouseEvent(event);
                            }
                        );
                    }
                }
            }

        }

        destroy() { }

        getBacklinks(mjxContainerEl: HTMLElement, event: MouseEvent, file: TFile, view: EditorView): Backlink[] | null {
            const cache = plugin.app.metadataCache.getFileCache(file);
            if (!cache) return null;

            const sec = getSectionCacheOfDOM(mjxContainerEl, "math", view, cache) ?? getSectionCacheFromMouseEvent(event, "math", view, cache);
            if (sec === undefined) return null;

            return getBacklinks(plugin.app, plugin, file, cache, (block) =>
                block.position.start.line == sec.position.start.line || block.position.end.line == sec.position.end.line || block.id == sec.id
            );
        }
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


export function replaceMathTag(displayMathEl: HTMLElement, text: string, mathLink: string | undefined, settings: Required<MathContextSettings>) {
    const tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }
    let tag = mathLink;
    if (mathLink) {
        tag = mathLink.slice(settings.eqRefPrefix.length, mathLink.length - settings.eqRefSuffix.length)
    }
    const taggedText = getMathTextWithTag(text, tag, settings.lineByLine);
    if (taggedText) {
        const mjxContainerEl = renderMath(taggedText, true);
        displayMathEl.replaceChildren(...mjxContainerEl.childNodes);
        finishRenderMath();
    }
}
