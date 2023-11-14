import { App, CachedMetadata, Component, Editor, ExtraButtonComponent, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Menu, Notice, TFile, parseLinktext, resolveSubpath } from "obsidian";
import { ViewUpdate, EditorView, PluginValue, ViewPlugin } from '@codemirror/view';

import MathBooster from './main';
import { TheoremCalloutModal } from './modals';
import { TheoremCalloutSettings, MathSettings, ResolvedMathSettings, MathContextSettings, TheoremCalloutPrivateFields } from './settings/settings';
import {
    increaseQuoteLevel, renderTextWithMath, formatTitle, formatTitleWithoutSubtitle, resolveSettings, splitIntoLines, isEditingView, getSectionCacheOfDOM, getSectionCacheFromMouseEvent,
    //getBacklinks 
} from './utils';
// import { AutoNoteIndexer } from './indexer';
// import { Backlink, BacklinkModal } from "./backlinks";
import { MarkdownPage, TheoremCalloutBlock } from "./index/typings/markdown";
import { MathIndex } from './index/index';


// export class TheoremCallout extends MarkdownRenderChild {
//     settings: TheoremCalloutSettings;
//     resolvedSettings: ResolvedMathSettings;
//     renderedTitleElements: (HTMLElement | string)[];

//     constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, settings: MathSettings, public currentFile: TFile, public context: MarkdownPostProcessorContext) {
//         super(containerEl);
//         this.settings = settings;
//         this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
//     }

//     async setRenderedTitleElements() {
//         // ex) "Theorem 1.1", not "Theorem 1.1 (Cauchy-Schwarz)"
//         const titleWithoutSubtitle = renderTextWithMath(formatTitleWithoutSubtitle(this.plugin, this.currentFile, this.resolvedSettings));
//         this.renderedTitleElements = [
//             ...titleWithoutSubtitle
//         ];
//         if (this.resolvedSettings.title) {
//             // ex) "(Cauchy-Schwarz)"
//             const subtitle = renderTextWithMath(`(${this.resolvedSettings.title})`);
//             const subtitleEl = createSpan({ cls: "theorem-callout-subtitle" });
//             subtitleEl.replaceChildren(...subtitle)
//             this.renderedTitleElements.push(" ", subtitleEl);
//         }
//         if (this.resolvedSettings.titleSuffix) {
//             this.renderedTitleElements.push(this.resolvedSettings.titleSuffix);
//         }
//     }

//     onload() {
//         // make sure setRenderedTitleElements() is called beforehand
//         const titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
//         titleInner?.replaceChildren(...this.renderedTitleElements);

//         // add classes for CSS snippets
//         this.containerEl.classList.add("theorem-callout");
//         const profile = this.plugin.extraSettings.profiles[this.resolvedSettings.profile];
//         for (const tag of profile.meta.tags) {
//             this.containerEl.classList.add("theorem-callout-" + tag);
//         }
//         this.containerEl.classList.add("theorem-callout-" + this.resolvedSettings.type);
//         this.containerEl.toggleClass(`theorem-callout-${this.resolvedSettings.theoremCalloutStyle.toLowerCase()}`, this.resolvedSettings.theoremCalloutStyle != "Custom");
//         this.containerEl.toggleClass("theorem-callout-font-family-inherit", this.resolvedSettings.theoremCalloutStyle != "Custom" && this.resolvedSettings.theoremCalloutFontInherit);

//         // // click the title block (div.callout-title) to edit settings
//         // const button = new ExtraButtonComponent(this.containerEl)
//         //     .setIcon("settings-2")
//         //     .setTooltip("Edit theorem callout settings");
//         // button.extraSettingsEl.addEventListener("click", (ev) => {
//         //     ev.stopPropagation();
//         //     const cache = this.app.metadataCache.getFileCache(this.currentFile);
//         //     const view = this.app.workspace.getActiveViewOfType(MarkdownView);
//         //     if (view?.file) {
//         //         // Make sure to get the line number BEFORE opening the modal!!
//         //         const lineNumber = this.getLineNumber(view, cache, ev);

//         //         new TheoremCalloutModal(
//         //             this.app,
//         //             this.plugin,
//         //             view.file,
//         //             async (settings) => {
//         //                 this.settings = settings;
//         //                 this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
//         //                 const title = formatTitle(this.plugin, this.currentFile, this.resolvedSettings);
//         //                 const indexer = (new AutoNoteIndexer(this.app, this.plugin, view.file!)).getIndexer();
//         //                 if (lineNumber !== undefined) {
//         //                     await indexer.calloutIndexer.overwriteSettings(lineNumber, this.settings, title);
//         //                 } else {
//         //                     new Notice(
//         //                         `${this.plugin.manifest.name}: Could not find the line number to overwrite. Retry later.`,
//         //                         5000
//         //                     )
//         //                 }
//         //             },
//         //             "Confirm",
//         //             "Edit theorem callout settings",
//         //             this.settings,
//         //         ).open();
//         //     }
//         // });
//         // button.extraSettingsEl.classList.add("theorem-callout-setting-button");

//         // this.plugin.registerDomEvent(
//         //     this.containerEl, "contextmenu", (event) => {
//         //         const menu = new Menu();

//         //         // Show backlinks
//         //         menu.addItem((item) => {
//         //             item.setTitle("Show backlinks");
//         //             item.onClick((clickEvent) => {
//         //                 if (clickEvent instanceof MouseEvent) {
//         //                     const backlinks = this.getBacklinks(event);
//         //                     new BacklinkModal(this.app, this.plugin, backlinks).open();
//         //                 }
//         //             })
//         //         });

//         //         menu.showAtMouseEvent(event);
//         //     }
//         // );
//     }

//     getLineNumber(view: MarkdownView, cache: CachedMetadata | null, event: MouseEvent): number | undefined {
//         const info = this.context.getSectionInfo(this.containerEl);
//         let lineNumber = info?.lineStart;
//         if (typeof lineNumber == "number") {
//             return lineNumber;
//         }

//         if (isEditingView(view) && view.editor.cm && cache) {
//             let sec = getSectionCacheOfDOM(this.containerEl, "callout", view.editor.cm, cache);
//             lineNumber = sec?.position.start.line;
//             if (typeof lineNumber == "number") {
//                 return lineNumber;
//             }

//             sec = getSectionCacheFromMouseEvent(event, "callout", view.editor.cm, cache)
//             lineNumber = sec?.position.start.line;
//             if (typeof lineNumber == "number") {
//                 return lineNumber;
//             }
//         } else {
//             // what can I do in reading view??
//         }
//     }

//     // getBacklinks(event: MouseEvent): Backlink[] | null {
//     //     const view = this.app.workspace.getActiveViewOfType(MarkdownView);
//     //     const cache = this.app.metadataCache.getFileCache(this.currentFile);
//     //     if (!view || !cache) return null;

//     //     const lineNumber = this.getLineNumber(view, cache, event);
//     //     if (typeof lineNumber != "number") return null;

//     //     return getBacklinks(this.app, this.plugin, this.currentFile, cache, (block) => block.position.start.line == lineNumber);
//     // }
// }


export function insertTheoremCalloutCallback(plugin: MathBooster, editor: Editor, config: MathSettings, currentFile: TFile) {
    const selection = editor.getSelection();
    const cursorPos = editor.getCursor();
    const resolvedSettings = resolveSettings(config, plugin, currentFile);
    const title = formatTitle(plugin, currentFile, resolvedSettings);

    if (selection) {
        const nLines = splitIntoLines(selection).length;
        editor.replaceSelection(
            `> [!math|${JSON.stringify(config)}] ${title}\n`
            + increaseQuoteLevel(selection)
        );
        cursorPos.line += nLines;
    } else {
        editor.replaceRange(
            `> [!math|${JSON.stringify(config)}] ${title}\n> `,
            cursorPos
        )
        cursorPos.line += 1;
    }
    cursorPos.ch = 2;
    editor.setCursor(cursorPos);
}



export const theoremCalloutPostProcessor = async (plugin: MathBooster, element: HTMLElement, context: MarkdownPostProcessorContext) => {

    const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return null;

    const resolvedSettings = resolveSettings(undefined, plugin, file);

    for (const calloutEl of element.querySelectorAll<HTMLElement>('.callout[data-callout="math"]')) {
        // console.log(element, context, context.getSectionInfo((context as any).containerEl));
        const theoremCallout = new TheoremCalloutRenderer(calloutEl, context, file, resolvedSettings, plugin);
        context.addChild(theoremCallout);
    }
}


export interface TheoremCalloutInfo {
    $numberSpec: string
    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "Theorem 1.1" */
    $theoremMainTitle: string;
    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "theorem" */
    $theoremType: string;
    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "Cauchy-Schwarz" */
    $theoremSubtitle: string | undefined;
    $titleSuffix: string;
}


/**
 * Reading view: Use the index. Listen to the index update event.
 * Live preview: The index might be out-of-date. Also, context.getSectionInfo() returns null.
 * Embeds: Read the target note path and the block id from the `src` attribute, and use it to find the corresponding TheoremCalloutBlock object from the index.
 * Hover popover: There is nothing I can do to get the number. Just display wihout the number.
 */

class TheoremCalloutRenderer extends MarkdownRenderChild {
    app: App;
    index: MathIndex;
    observer: MutationObservingChild;

    constructor(
        containerEl: HTMLElement,
        public context: MarkdownPostProcessorContext,
        public file: TFile,
        public resolvedSettings: Required<MathContextSettings>,
        public plugin: MathBooster
    ) {
        super(containerEl);
        this.app = plugin.app;
        this.index = plugin.indexManager.index;
        this.addChild(this.observer = new MutationObservingChild(this.containerEl, (mutations) => {
            for (const mutation of mutations) {
                if (mutation.oldValue !== this.containerEl.getAttribute('data-theorem-index')) {
                    this.update();
                }
            }
        }, {
            attributeFilter: ['data-theorem-index'],
            attributeOldValue: true,
        }))
    }

    getPage(): MarkdownPage | null {
        const page = this.plugin.indexManager.index.load(this.context.sourcePath);
        if (MarkdownPage.isMarkdownPage(page)) return page;
        return null;
    }

    onload() {
        this.update();
        this.registerEvent(this.app.metadataCache.on('math-booster:index-updated', (file) => {
            if (file.path === this.file.path) {
                // TODO: only update the number part
                this.update();
            }
        }));
    }

    update() {
        let block = this.findTheoremCalloutBlock();
        let info: TheoremCalloutInfo | null = block ?? this.getTheoremCalloutInfoFromEl();
        if (!info) return;

        this.renderTitle(info);
        this.addCssClasses(info);

        setTimeout(() => {
            if (this.containerEl.closest('.hover-popover:not(.hover-editor)')) {
                const update = this.correctHover(); // give up auto-numbering! (if you want it, use hover editor!)
                if (update) {
                    block = update.block;
                    info = update.info;
                }
            }
            if (block) {
                const updated = this.correctEmbed(block, info!)!; // correct line number
                block = updated.block;
                info = updated.info;
            }
        });
    }

    correctHover() {
        const block = null;
        const info = this.getTheoremCalloutInfoFromEl();
        if (!info) return;
        this.renderTitle(info);
        this.addCssClasses(info);
        return { block, info };
    }

    correctEmbed(block: TheoremCalloutBlock, info: TheoremCalloutInfo) {
        const linktext = this.containerEl.closest('[src]')?.getAttribute('src');
        if (linktext) {
            const { path, subpath } = parseLinktext(linktext);
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(path, this.context.sourcePath);
            if (!targetFile) return;
            const targetCache = this.app.metadataCache.getFileCache(targetFile);
            if (!targetCache) return;
            const result = resolveSubpath(targetCache, subpath);
            if (result.type === 'block') {
                if (result.block.id !== block.$blockId) {
                    const _block = this.getPage()?.$blocks.get(result.block.id);
                    if (TheoremCalloutBlock.isTheoremCalloutBlock(_block)) {
                        info = block = _block;
                        this.renderTitle(info);
                        this.addCssClasses(info);
                    }
                }
            } else if (result.type === 'heading') {
                const _block = this.findTheoremCalloutBlock(result.start.line);
                if (_block) {
                    info = block = _block;
                    this.renderTitle(info);
                    this.addCssClasses(info);
                }
            }
        }
        return { block, info };
    }

    /** Find the corresponding TheoremCalloutBlock object from the index. */
    findTheoremCalloutBlock(lineOffset: number = 0): TheoremCalloutBlock | null {
        const page = this.getPage();
        if (!page) return null;

        const info = this.context.getSectionInfo(this.containerEl);
        if (!info) return null;

        const block = page.getBlockByLineNumber(info.lineStart + lineOffset) ?? page.getBlockByLineNumber(info.lineEnd + lineOffset);
        if (!TheoremCalloutBlock.isTheoremCalloutBlock(block)) return null;

        return block;
    }

    getTheoremCalloutInfoFromEl(): TheoremCalloutInfo | null {
        const settings: (TheoremCalloutSettings & TheoremCalloutPrivateFields) | null = readSettingsFromEl(this.containerEl);
        if (!settings) return null;
        const livePreviewIndex = this.containerEl.getAttribute('data-theorem-index');
        if (livePreviewIndex !== null) settings._index = +livePreviewIndex;

        return {
            $numberSpec: settings.number,
            $theoremMainTitle: formatTitleWithoutSubtitle(this.plugin, this.file, Object.assign(settings, this.resolvedSettings)),
            $theoremType: settings.type,
            $theoremSubtitle: settings.title,
            $titleSuffix: this.resolvedSettings.titleSuffix
        };
    }

    renderTitle(info: TheoremCalloutInfo) {
        const titleElements = renderTextWithMath(info.$theoremMainTitle);
        if (info.$theoremSubtitle) {
            const subtitle = renderTextWithMath(`(${info.$theoremSubtitle})`);
            const subtitleEl = createSpan({ cls: "theorem-callout-subtitle" });
            subtitleEl.replaceChildren(...subtitle)
            titleElements.push(" ", subtitleEl);
        }
        if (info.$titleSuffix) {
            titleElements.push(info.$titleSuffix);
        }

        const titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        titleInner?.replaceChildren(...titleElements);
    }

    addCssClasses(info: TheoremCalloutInfo) {
        this.containerEl.classList.forEach((cls, _, list) => {
            if (cls.startsWith('theorem-callout')) list.remove(cls);
        });
        this.containerEl.classList.add("theorem-callout");
        const profile = this.plugin.extraSettings.profiles[this.resolvedSettings.profile];
        for (const tag of profile.meta.tags) {
            this.containerEl.classList.add("theorem-callout-" + tag);
        }
        this.containerEl.classList.add("theorem-callout-" + info.$theoremType);
        this.containerEl.toggleClass(`theorem-callout-${this.resolvedSettings.theoremCalloutStyle.toLowerCase()}`, this.resolvedSettings.theoremCalloutStyle != "Custom");
        this.containerEl.toggleClass("theorem-callout-font-family-inherit", this.resolvedSettings.theoremCalloutStyle != "Custom" && this.resolvedSettings.theoremCalloutFontInherit);
    }
}


export const theoremCalloutNumberingViewPlugin = (plugin: MathBooster) => {
    return ViewPlugin.fromClass(
        class implements PluginValue {
            constructor(public view: EditorView) {
                // Wait until the initial rendering is done so that we can find the callout elements using qeurySelectorAll(). 
                setTimeout(() => this.impl(view));
            }
            update(update: ViewUpdate) {
                setTimeout(() => this.impl(update.view));
            }
            impl(view: EditorView) {
                let theoremCount = 0;
                for (const calloutEl of view.contentDOM.querySelectorAll<HTMLElement>('.callout[data-callout="math"], .theorem-callout-title')) {
                    // in the case of a theorem callout that the cursor is overlapping with
                    if (calloutEl.matches('.theorem-callout-title[data-auto-number="true"]')) {
                        theoremCount++;
                        continue;
                    }
                    const settings = readSettingsFromEl(calloutEl);
                    if (settings?.number === 'auto') {
                        calloutEl.setAttribute('data-theorem-index', String(theoremCount++));
                    } else {
                        calloutEl.removeAttribute('data-theorem-index');
                    }
                }
            }
        }
    )
}


/** Read TheoremCalloutSettings from the element's attribute. */
function readSettingsFromEl(calloutEl: HTMLElement): TheoremCalloutSettings | null {
    const metadata = calloutEl.getAttribute('data-callout-metadata');
    if (!metadata) return null;
    const settings = JSON.parse(metadata) as TheoremCalloutSettings;
    // @ts-ignore
    delete settings['_index']; // do not use the legacy "_index" value
    return settings;
}


class MutationObservingChild extends Component {
    observer: MutationObserver;

    constructor(public targetEl: HTMLElement, public callback: MutationCallback, public options: MutationObserverInit) {
        super();
        this.observer = new MutationObserver(callback);
    }

    onload() {
        this.observer.observe(this.targetEl, this.options);
    }

    onunload() {
        this.observer.disconnect();
    }
}
