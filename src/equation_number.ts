import { App, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, CachedMetadata, MarkdownSectionInformation, TFile, editorInfoField, Menu } from "obsidian";
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

import MathBooster from './main';
import { getBacklinks, getMathCache, getSectionCacheFromMouseEvent, getSectionCacheOfDOM, resolveSettings } from './utils';
import { MathContextSettings } from "./settings/settings";
import { Backlink, BacklinkModal } from "./backlinks";
import { AutoNoteIndexer } from "./indexer";


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
                        this.impl()
                    }
                }
            )
        );
        (new AutoNoteIndexer(this.app, this.plugin, this.file)).run();
    }

    async impl() {
        this.setId();
        if (this.id) {
            const item = this.plugin.index.getNoteIndex(this.file).getItemById(this.id);
            if (item?.type == "equation" && item.mathText) {
                const settings = resolveSettings(undefined, this.plugin, this.file);
                replaceMathTag(this.containerEl, item.mathText, item.printName, settings);
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
            if (info.file) {
                this.callback(view, info.file);
            }
        }

        async callback(view: EditorView, file: TFile) {
            const mjxContainerElements = view.contentDOM.querySelectorAll<HTMLElement>('mjx-container.MathJax[display="true"]');
            const cache = app.metadataCache.getFileCache(file);
            if (cache) {
                for (const mjxContainerEl of mjxContainerElements) {
                    try {
                        const pos = view.posAtDOM(mjxContainerEl);
                        const item = plugin.index.getNoteIndex(file).getItemByPos(pos, "equation");
                        if (item?.mathText) {
                            const settings = resolveSettings(undefined, plugin, file);
                            replaceMathTag(mjxContainerEl, item.mathText, item.printName, settings);
                            plugin.registerDomEvent(
                                mjxContainerEl, "contextmenu", (event) => {
                                    const menu = new Menu();

                                    // Show backlinks
                                    menu.addItem((item) => {
                                        item.setTitle("Show backlinks");
                                        item.onClick((clickEvent) => {
                                            if (clickEvent instanceof MouseEvent) {
                                                const backlinks = this.getBacklinks(mjxContainerEl, event, file, view);
                                                new BacklinkModal(plugin.app, plugin, backlinks).open();
                                            }
                                        })
                                    });

                                    menu.showAtMouseEvent(event);
                                }
                            );
                        }
                    } catch (err) {
                        // try it again later
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

export function getMathTextWithTag(text: string, tag: string | undefined, lineByLine?: boolean): string | undefined {
    if (tag) {
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
    return text.replace(/[\n\r]/g, ' ') + `\\tag{${tagContent}}`;
}


export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string | undefined, settings: Required<MathContextSettings>) {
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
