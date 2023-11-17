import { RangeSetBuilder } from '@codemirror/state';
import { App, Component, Editor, ExtraButtonComponent, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Notice, TFile } from "obsidian";
import { ViewUpdate, EditorView, PluginValue, ViewPlugin, Decoration, DecorationSet } from '@codemirror/view';

import MathBooster from 'main';
import { TheoremCalloutModal } from 'settings/modals';
import { TheoremCalloutSettings, TheoremCalloutPrivateFields, MinimalTheoremCalloutSettings } from 'settings/settings';
import {
    increaseQuoteLevel, resolveSettings
    //getBacklinks 
} from './utils/plugin';
import { isEditingView, nodeText } from 'utils/editor';
import { capitalize, splitIntoLines } from 'utils/general';
import { formatTitleWithoutSubtitle } from "utils/format";
import { renderTextWithMath } from "utils/render";
// import { AutoNoteIndexer } from './indexer';
// import { Backlink, BacklinkModal } from "./backlinks";
import { MarkdownPage, TheoremCalloutBlock } from "index/typings/markdown";
import { MathIndex } from 'index/index';
import { parseTheoremCalloutMetadata, readTheoremCalloutSettings } from 'utils/parse';
import { THEOREM_LIKE_ENV_ID_PREFIX_MAP, THEOREM_LIKE_ENV_IDs, THEOREM_LIKE_ENV_PREFIXES, THEOREM_LIKE_ENV_PREFIX_ID_MAP, TheoremLikeEnvID, TheoremLikeEnvPrefix } from 'env';
import { getIO } from 'file_io';
import { getSectionCacheFromMouseEvent, getSectionCacheOfDOM, resolveLinktext } from 'utils/obsidian';
import { syntaxTree } from '@codemirror/language';
import { CALLOUT } from 'theorem_callout_metadata_hider';


function generateTheoremCalloutFirstLine(config: TheoremCalloutSettings): string {
    const metadata = config.number === 'auto' ? '' : config.number === '' ? '|*' : `|${config.number}`;
    let firstLine = `> [!${config.type}${metadata}]${config.fold ?? ''}${config.title ? ' ' + config.title : ''}`
    if (config.label) firstLine += `\n> %% label: ${config.label} %%`;
    return firstLine;
}

export function insertTheoremCalloutCallback(editor: Editor, config: TheoremCalloutSettings): void {
    const selection = editor.getSelection();
    const cursorPos = editor.getCursor();

    const firstLine = generateTheoremCalloutFirstLine(config);

    if (selection) {
        const nLines = splitIntoLines(selection).length;
        editor.replaceSelection(firstLine + '\n' + increaseQuoteLevel(selection));
        cursorPos.line += nLines;
    } else {
        editor.replaceRange(firstLine + '\n> ', cursorPos)
        cursorPos.line += 1;
    }

    if (config.label) cursorPos.line += 1;
    cursorPos.ch = 2;
    editor.setCursor(cursorPos);
}


export const theoremCalloutPostProcessor = async (plugin: MathBooster, element: HTMLElement, context: MarkdownPostProcessorContext) => {

    const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return null;

    for (const calloutEl of element.querySelectorAll<HTMLElement>(`.callout`)) {
        const type = calloutEl.getAttribute('data-callout')!.toLowerCase();

        if ((THEOREM_LIKE_ENV_IDs as unknown as string[]).includes(type) || (THEOREM_LIKE_ENV_PREFIXES as unknown as string[]).includes(type) || type === 'math') {
            if (plugin.extraSettings.excludeExampleCallout && type === 'example') continue;
            
            const theoremCallout = new TheoremCalloutRenderer(calloutEl, context, file, plugin);
            context.addChild(theoremCallout);
        }
    }
}


export interface TheoremCalloutInfo {
    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "theorem" */
    theoremType: string;
    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "Theorem 1.1" */
    theoremMainTitle: string;
    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "Cauchy-Schwarz" */
    theoremSubtitleEl: HTMLElement | null;
    titleSuffix: string;
}


/**
 * Renders theorem callouts. The rendering strategy varys depending on the given situation:
 * 
 * Reading view: 
 *     Use the index. Listen to the index update event.
 * Live preview: 
 *     The index might be out-of-date. Also, context.getSectionInfo() returns null. 
 *     Thus, I'm currently taking a rather hacky or dirty approach, where I set "data-theorem-index" attribute 
 *     indicating a 0-based index of auto-numbered theorems in a document for every editor updates 
 *     using a CodeMirror6 view plugin called theoremCalloutNumberingViewPlugin.
 * Embeds: 
 *     Read the target note path and the block id from the `src` attribute, and 
 *     use it to find the corresponding TheoremCalloutBlock object from the index.
 * Hover popover: 
 *     There is nothing I can do to get the number. Just display wihout the number.
 */
class TheoremCalloutRenderer extends MarkdownRenderChild {
    app: App;
    index: MathIndex;
    observer: MutationObservingChild;
    /** The info on which the last DOM update was based on. Used to reduce redundant updates. */
    info: TheoremCalloutInfo | null = null;
    isHoverPopover: boolean = false;
    /** Set to the linktext when this theorem callout is inside an embed (i.e. ![[linktext]]). */
    embedSrc: string | null = null;
    editButton: HTMLElement | null = null;

    constructor(
        containerEl: HTMLElement,
        public context: MarkdownPostProcessorContext,
        public file: TFile,
        public plugin: MathBooster
    ) {
        super(containerEl);
        this.app = plugin.app;
        this.index = plugin.indexManager.index;

        // update: for live preview
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

        // update when the math index is updated
        this.registerEvent(this.app.metadataCache.on('math-booster:index-updated', (file) => {
            if (file.path === this.file.path) {
                this.update();
            }
        }));

        // remove the edit button when Math Booster gets disabled
        this.plugin.addChild(this);
        this.register(() => this.removeEditButton());
        // remove the edit button when the relevent setting is disabled
        this.registerEvent(this.app.metadataCache.on('math-booster:global-settings-updated', () => {
            if (this.plugin.extraSettings.showTheoremCalloutEditButton) {
                this.addEditButton();
            } else {
                this.removeEditButton();
            }
        }));
    }

    getPage(): MarkdownPage | null {
        const page = this.plugin.indexManager.index.load(this.context.sourcePath);
        if (MarkdownPage.isMarkdownPage(page)) return page;
        return null;
    }

    isLivePreview(): boolean {
        return this.containerEl.closest('.markdown-source-view.is-live-preview') !== null;
    }

    onload() {
        this.update();
    }

    update() {
        const existingMainTitleEl = this.containerEl.querySelector<HTMLElement>(".theorem-callout-main-title");

        if (existingMainTitleEl && this.isLivePreview()) {
            // only update the main title part (e.g. "Theorem 1.2")

            // Here, settings.title might be incorrect (e.g. "Theorem 1.2 (Cauchy-Schwarz)" instead of "Cauchy-Schwarz"), 
            // but it is not a problem because we are only updating the main title part.
            const settings: (TheoremCalloutSettings & TheoremCalloutPrivateFields) | null = readSettingsFromEl(this.containerEl);
            if (!settings) return null;

            const livePreviewIndex = this.containerEl.getAttribute('data-theorem-index');
            if (livePreviewIndex !== null) settings._index = +livePreviewIndex;

            const resolvedSettings = resolveSettings(settings, this.plugin, this.file);
            const newMainTitle = formatTitleWithoutSubtitle(this.plugin, this.file, resolvedSettings);

            existingMainTitleEl.setText(newMainTitle);
            this.info = null;

            return;
        }

        let block = this.getTheoremCalloutInfoFromIndex();
        let info: TheoremCalloutInfo | null = block ?? this.getTheoremCalloutInfoFromEl();
        if (!info) {
            this.info = null;
            return
        };

        if (!this.info || TheoremCalloutRenderer.areDifferentInfo(info, this.info)) {
            this.renderTitle(info, existingMainTitleEl);
            this.addCssClasses(info);
            this.addEditButton();

            this.info = info;
        }

        // In embeds or hover popover, we can get an incorrect TheoremCalloutBlock because 
        // MarkdownPostProcessorContext.getSectionInfo() returns incorrect line numbers.
        // So we have to correct it manually.
        setTimeout(() => {
            if (this.containerEl.closest('.hover-popover:not(.hover-editor)')) {
                this.isHoverPopover = true;
                const update = this.correctHover(); // give up auto-numbering! (if you want it, use hover editor!)
                if (update) {
                    block = update.block;
                    this.info = info = update.info;
                }
            } else if (block) {
                const update = this.correctEmbed(block, info!); // correct line number
                if (update) {
                    block = update.block;
                    this.info = info = update.info;
                }
            }
        });
    }

    correctHover() {
        const block = null;
        const info = this.getTheoremCalloutInfoFromEl();
        if (!info) return;

        if (!this.info || TheoremCalloutRenderer.areDifferentInfo(info, this.info)) {
            this.renderTitle(info);
            this.addCssClasses(info);
        }

        this.removeEditButton();

        return { block, info };
    }

    correctEmbed(block: TheoremCalloutInfo & { blockId?: string }, info: TheoremCalloutInfo) {
        const linktext = this.containerEl.closest('[src]')?.getAttribute('src');
        if (linktext) {
            this.embedSrc = linktext;
            const { subpathResult: result } = resolveLinktext(this.app, linktext, this.context.sourcePath) ?? {};
            if (!result) return;

            if (result.type === 'block') {
                if (result.block.id !== block.blockId) {
                    const _block = this.getPage()?.$blocks.get(result.block.id);
                    if (TheoremCalloutBlock.isTheoremCalloutBlock(_block)) {
                        info = block = this.blockToInfo(_block);
                        if (!this.info || TheoremCalloutRenderer.areDifferentInfo(info, this.info)) {
                            this.renderTitle(info);
                            this.addCssClasses(info);
                        }
                    }
                }
            } else if (result.type === 'heading') {
                const _block = this.findTheoremCalloutBlock(result.start.line);
                if (_block) {
                    info = block = this.blockToInfo(_block);
                    if (!this.info || TheoremCalloutRenderer.areDifferentInfo(info, this.info)) {
                        this.renderTitle(info);
                        this.addCssClasses(info);
                    }
                }
            }
        }

        this.addEditButton();

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

    blockToInfo(block: TheoremCalloutBlock): TheoremCalloutInfo & { blockId?: string } {
        let theoremSubtitleEl: HTMLElement | null = null;

        if (block.$theoremSubtitle) {
            theoremSubtitleEl = createSpan({ cls: "theorem-callout-subtitle" });
            const subtitle = renderTextWithMath(`(${block.$theoremSubtitle})`);
            theoremSubtitleEl.replaceChildren(...subtitle);
        }

        return {
            theoremType: block.$theoremType,
            theoremMainTitle: block.$theoremMainTitle,
            theoremSubtitleEl,
            titleSuffix: block.$titleSuffix,
            blockId: block.$blockId,
        };
    }

    getTheoremCalloutInfoFromIndex(): TheoremCalloutInfo & { blockId?: string } | null {
        const block = this.findTheoremCalloutBlock();
        if (!block) return null;
        return this.blockToInfo(block);
    }

    // this method is expected to be called for live preview only
    getTheoremCalloutInfoFromEl(): TheoremCalloutInfo | null {
        const settings: (TheoremCalloutSettings & TheoremCalloutPrivateFields) | null = readSettingsFromEl(this.containerEl);
        if (!settings) return null;
        const livePreviewIndex = this.containerEl.getAttribute('data-theorem-index');
        if (livePreviewIndex !== null) settings._index = +livePreviewIndex;
        const resolvedSettings = resolveSettings(settings, this.plugin, this.file);

        let theoremSubtitleEl = this.containerEl.querySelector<HTMLElement>('.theorem-callout-subtitle');
        if (theoremSubtitleEl === null) {
            const titleInnerEl = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
            if (titleInnerEl?.childNodes.length) {
                if (titleInnerEl.textContent !== capitalize(settings.type) && titleInnerEl.textContent !== capitalize(THEOREM_LIKE_ENV_ID_PREFIX_MAP[settings.type as TheoremLikeEnvID])) {
                    theoremSubtitleEl = createSpan({ cls: "theorem-callout-subtitle" });
                    theoremSubtitleEl.replaceChildren('(', ...titleInnerEl.childNodes, ')');
                }
            }
        }

        return {
            theoremType: settings.type,
            theoremMainTitle: formatTitleWithoutSubtitle(this.plugin, this.file, resolvedSettings),
            theoremSubtitleEl,
            titleSuffix: resolvedSettings.titleSuffix
        };
    }

    renderTitle(info: TheoremCalloutInfo, existingMainTitleEl?: HTMLElement | null) {
        const titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        if (!titleInner) throw Error(`Math Booster: Failed to find the title element of a theorem callout.`);

        const newMainTitleEl = createSpan({
            text: info.theoremMainTitle,
            cls: "theorem-callout-main-title"
        });

        if (existingMainTitleEl) {
            // only update the main title part
            existingMainTitleEl.replaceWith(newMainTitleEl);
            return;
        }

        const titleElements: (HTMLElement | string)[] = [newMainTitleEl];

        if (info.theoremSubtitleEl) {
            titleElements.push(" ", info.theoremSubtitleEl);
        }
        if (info.titleSuffix) {
            titleElements.push(info.titleSuffix);
        }

        titleInner.replaceChildren(...titleElements);
    }

    addCssClasses(info: TheoremCalloutInfo) {
        this.containerEl.classList.forEach((cls, _, list) => {
            if (cls.startsWith('theorem-callout')) list.remove(cls);
        });
        this.containerEl.classList.add("theorem-callout");
        const resolvedSettings = resolveSettings(undefined, this.plugin, this.file);
        const profile = this.plugin.extraSettings.profiles[resolvedSettings.profile];
        for (const tag of profile.meta.tags) {
            this.containerEl.classList.add("theorem-callout-" + tag);
        }
        this.containerEl.classList.add("theorem-callout-" + info.theoremType);
        this.containerEl.toggleClass(`theorem-callout-${resolvedSettings.theoremCalloutStyle.toLowerCase()}`, resolvedSettings.theoremCalloutStyle != "Custom");
        this.containerEl.toggleClass("theorem-callout-font-family-inherit", resolvedSettings.theoremCalloutStyle != "Custom" && resolvedSettings.theoremCalloutFontInherit);
    }

    removeEditButton() {
        if (this.editButton) {
            this.editButton.remove();
            this.editButton = null;
        }
    }

    addEditButton() {
        if (!this.plugin.extraSettings.showTheoremCalloutEditButton) return;
        if (this.editButton) return; // already exists

        const button = new ExtraButtonComponent(this.containerEl)
            .setIcon("settings-2")
            .setTooltip("Edit theorem callout settings");

        this.editButton = button.extraSettingsEl;
        this.editButton.addClass("theorem-callout-setting-button");

        button.extraSettingsEl.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const io = getIO(this.plugin, this.file);

            // Make sure to get the line number BEFORE opening the modal!!
            const lineNumber = this.getLineNumber(ev);
            if (lineNumber === null) return;
            const line = await io.getLine(lineNumber);

            new TheoremCalloutModal(this.app, this.plugin, this.file, async (settings) => {
                if (lineNumber !== undefined) {
                    await io.setLine(lineNumber, generateTheoremCalloutFirstLine(settings));
                } else {
                    new Notice(
                        `${this.plugin.manifest.name}: Could not find the line number to overwrite. Retry later.`,
                        5000
                    )
                }
            },
                "Confirm",
                "Edit theorem callout settings",
                readTheoremCalloutSettings(line, this.plugin.extraSettings.excludeExampleCallout)
            ).open();
        });
    }

    getLineNumber(event: MouseEvent): number | null {
        let lineOffset = 0;

        // handle the embed case
        if (this.embedSrc !== null) {
            const { subpathResult } = resolveLinktext(this.app, this.embedSrc, this.context.sourcePath) ?? {};
            if (subpathResult) lineOffset = subpathResult.start.line;
        }

        const info = this.context.getSectionInfo(this.containerEl);
        if (info) return lineOffset + info.lineStart;

        const cache = this.app.metadataCache.getFileCache(this.file);
        if (!cache) return null;
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return null;

        if (isEditingView(view) && this.file.path === view.file?.path && view.editor.cm) {
            let sec = getSectionCacheOfDOM(this.containerEl, "callout", view.editor.cm, cache)
                ?? getSectionCacheFromMouseEvent(event, "callout", view.editor.cm, cache)
            if (sec) return sec.position.start.line;
        }

        // What can I do in reading view??

        return null;
    }

    static areDifferentInfo(info1: TheoremCalloutInfo, info2: TheoremCalloutInfo) {
        return info1.theoremMainTitle !== info2.theoremMainTitle;
    }
}


export const theoremCalloutNumberingViewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
        constructor(public view: EditorView) {
            // Wait until the initial rendering is done so that we can find the callout elements using qeurySelectorAll(). 
            setTimeout(() => this.impl(view));
        }
        update(update: ViewUpdate) {
            this.impl(update.view)
            // setTimeout(() => this.impl(update.view));
        }
        impl(view: EditorView) {
            let theoremCount = 0;
            for (const calloutEl of view.contentDOM.querySelectorAll<HTMLElement>('.callout.theorem-callout, .theorem-callout-first-line')) {
                // in the case of a theorem callout that the cursor is overlapping with
                if (calloutEl.matches('.theorem-callout-first-line[data-auto-number="true"]')) {
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
);


/** Read TheoremCalloutSettings from the element's attribute. */
function readSettingsFromEl(calloutEl: HTMLElement): TheoremCalloutSettings | null {
    let type = calloutEl.getAttribute('data-callout')?.trim().toLowerCase();
    if (type === undefined) return null;

    const metadata = calloutEl.getAttribute('data-callout-metadata');
    if (metadata === null) return null;

    if (type === 'math') {
        // legacy format
        const settings = JSON.parse(metadata) as TheoremCalloutSettings;
        // @ts-ignore
        delete settings['_index']; // do not use the legacy "_index" value
        return settings;
    }

    // new format
    if (type.length <= 4) { // use length to avoid iterating over all the prefixes
        // convert a prefix to an ID (e.g. "thm" -> "theorem")
        type = THEOREM_LIKE_ENV_PREFIX_ID_MAP[type as TheoremLikeEnvPrefix];
    }

    const number = parseTheoremCalloutMetadata(metadata);

    const title = '' // calloutEl.querySelector<HTMLElement>('.callout-title-inner')?.textContent?.trim();

    return { type, number, title }
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


export const createTheoremCalloutFirstLineDecorator = (plugin: MathBooster) => ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;


        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const tree = syntaxTree(view.state);

            // assuming the theorem callout that is currently being edited is inside the viewport
            for (const { from, to } of view.visibleRanges) {
                tree.iterate({
                    from, to,
                    enter(node) {
                        const match = node.name.match(CALLOUT);
                        if (!match) return;

                        const text = nodeText(node, view.state);
                        const settings = readTheoremCalloutSettings(text, plugin.extraSettings.excludeExampleCallout);
                        if (!settings) return;

                        builder.add(
                            node.from,
                            node.from,
                            Decoration.line({
                                class: 'theorem-callout-first-line',
                                attributes: { "data-auto-number": settings.number === 'auto' ? 'true' : 'false' }
                            })
                        );

                        return false;
                    }
                })
            }

            return builder.finish();
        }
    }, {
    decorations: (v) => v.decorations
});


export async function rewriteTheoremCalloutFromV1ToV2(plugin: MathBooster, file: TFile) {
    const { app, indexManager } = plugin;

    const page = await indexManager.reload(file);
    await app.vault.process(file, (data) => convertTheoremCalloutFromV1ToV2(data, page));
}


export const convertTheoremCalloutFromV1ToV2 = (data: string, page: MarkdownPage) => {
    const lines = data.split('\n');
    const newLines = [...lines];
    let lineAdded = 0;

    for (const section of page.$sections) {
        for (const block of section.$blocks) {
            if (!TheoremCalloutBlock.isTheoremCalloutBlock(block)) continue;
            if (!block.$v1) continue

            const newHeadLines = [generateTheoremCalloutFirstLine({
                type: block.$settings.type,
                number: block.$settings.number,
                title: block.$settings.title
            })];
            const legacySettings = block.$settings as any;
            if (legacySettings.label) newHeadLines.push(`> %% label: ${legacySettings.label} %%`);
            if (legacySettings.setAsNoteMathLink) newHeadLines.push(`> %% main %%`);

            newLines.splice(block.$position.start + lineAdded, 1, ...newHeadLines);

            lineAdded += newHeadLines.length - 1;
        }
    }

    return newLines.join('\n');
} 
