import { App, CachedMetadata, Editor, ExtraButtonComponent, LinkCache, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Menu, Notice, Pos, TFile, parseLinktext, resolveSubpath } from "obsidian";

import MathBooster from './main';
import { MathCalloutModal } from './modals';
import { MathCalloutSettings, MathSettings, ResolvedMathSettings } from './settings/settings';
import { increaseQuoteLevel, renderTextWithMath, formatTitle, formatTitleWithoutSubtitle, resolveSettings, splitIntoLines, getSectionCacheFromPos, isEditingView } from './utils';
import { AutoNoteIndexer } from './indexer';
import { Backlink, BacklinkModal } from "backlinks";
import { getIO } from "file_io";


export class MathCallout extends MarkdownRenderChild {
    settings: MathCalloutSettings;
    resolvedSettings: ResolvedMathSettings;
    renderedTitleElements: (HTMLElement | string)[];

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, settings: MathSettings, public currentFile: TFile, public context: MarkdownPostProcessorContext) {
        super(containerEl);
        this.settings = settings;
        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
    }

    async setRenderedTitleElements() {
        // ex) "Theorem 1.1", not "Theorem 1.1 (Cauchy-Schwarz)"
        const titleWithoutSubtitle = await renderTextWithMath(formatTitleWithoutSubtitle(this.plugin, this.resolvedSettings));
        this.renderedTitleElements = [
            ...titleWithoutSubtitle
        ];
        if (this.resolvedSettings.title) {
            // ex) "(Cauchy-Schwarz)"
            const subtitle = await renderTextWithMath(`(${this.resolvedSettings.title})`);
            const subtitleEl = createSpan({ cls: "math-callout-subtitle" });
            subtitleEl.replaceChildren(...subtitle)
            this.renderedTitleElements.push(" ", subtitleEl);
        }
        if (this.resolvedSettings.titleSuffix) {
            this.renderedTitleElements.push(this.resolvedSettings.titleSuffix);
        }
    }

    onload() {
        // make sure setRenderedTitleElements() is called beforehand
        const titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        titleInner?.replaceChildren(...this.renderedTitleElements);

        // add classes for CSS snippets
        this.containerEl.classList.add("math-callout");
        const profile = this.plugin.extraSettings.profiles[this.resolvedSettings.profile];
        for (const tag of profile.meta.tags) {
            this.containerEl.classList.add("math-callout-" + tag);
        }
        this.containerEl.classList.add("math-callout-" + this.resolvedSettings.type);
        this.containerEl.toggleClass(`math-callout-${this.resolvedSettings.mathCalloutStyle}`, this.resolvedSettings.mathCalloutStyle != "custom");
        this.containerEl.toggleClass("math-callout-font-family-inherit", this.resolvedSettings.mathCalloutStyle != "custom" && this.resolvedSettings.mathCalloutFontInherit);

        // click the title block (div.callout-title) to edit settings
        const button = new ExtraButtonComponent(this.containerEl)
            .setIcon("settings-2")
            .setTooltip("Edit math callout settings");
        button.extraSettingsEl.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const cache = this.app.metadataCache.getFileCache(this.currentFile);
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const editor = view?.editor;
            if (editor) {
                // Make sure to get the line number BEFORE opening the modal!!
                const lineNumber = this.getLineNumber(view, cache, ev);

                new MathCalloutModal(
                    this.app,
                    this.plugin,
                    view.file,
                    async (settings) => {
                        this.settings = settings;
                        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
                        const title = formatTitle(this.plugin, this.resolvedSettings);
                        const indexer = (new AutoNoteIndexer(this.app, this.plugin, view.file)).getIndexer();
                        if (lineNumber !== undefined) {
                            await indexer.calloutIndexer.overwriteSettings(lineNumber, this.settings, title);
                        } else {
                            new Notice(
                                `${this.plugin.manifest.name}: Could not find the line number to overwrite. Retry later.`,
                                5000
                            )
                        }
                    },
                    "Confirm",
                    "Edit math callout settings",
                    this.settings,
                ).open();
            }
        });
        button.extraSettingsEl.classList.add("math-callout-setting-button");

        this.plugin.registerDomEvent(
            this.containerEl, "contextmenu", (event) => {
                const menu = new Menu();

                // Show backlinks
                menu.addItem((item) => {
                    item.setTitle("Show backlinks");
                    item.onClick((clickEvent) => {
                        if (clickEvent instanceof MouseEvent) {
                            const backlinks = this.getBacklinks(clickEvent);
                            new BacklinkModal(this.app, this.plugin, backlinks).open();
                        }
                    })
                });

                // // Go to proof
                // menu.addItem((item) => {
                //     item.setTitle("Go to proof");
                //     item.onClick(async (clickEvent) => {
                //         const cache = this.app.metadataCache.getFileCache(this.currentFile);
                //         const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                //         const settings = resolveSettings(undefined, this.plugin, this.currentFile);
                //         const proofs: Backlink[] = [];

                //         if (cache?.sections && view) {
                //             const io = getIO(this.plugin, this.currentFile);
                //             const lineNumber = this.getLineNumber(view, cache, event);
                //             if (lineNumber) {
                //                 const index = cache.sections.findIndex((sec) => sec.position.start.line <= lineNumber && lineNumber <= sec.position.end.line);
                //                 if (0 <= index && index <= cache.sections.length - 2) {
                //                     const nextSec = cache.sections[index + 1];
                //                     const nextSecFirstLine = await io.getLine(nextSec.position.start.line);
                //                     const nextSecIsProof = nextSecFirstLine.startsWith("`" + settings.beginProof + "`");
                //                     if (nextSecIsProof) {
                //                         proofs.push({
                //                             position: nextSec.position,
                //                             sourcePath: this.currentFile.path,
                //                         })
                //                     }
                //                 }
                //             }
                //         }

                //         if (clickEvent instanceof MouseEvent) {
                //             const backlinks = this.getBacklinks(clickEvent);

                //             if (backlinks) {
                //                 await Promise.all(
                //                     backlinks.map(async (backlink) => {
                //                         const file = this.app.vault.getAbstractFileByPath(backlink.sourcePath);
                //                         if (file instanceof TFile) {
                //                             const start = backlink.position.start;
                //                             const io = getIO(this.plugin, file);
                //                             // 3 = "`".length + "`".length + "@".length
                //                             const offset = settings.beginProof.length + 3;
                //                             if (start.col >= offset) {
                //                                 const preLink = await io.getRange({
                //                                     start: { line: start.line, col: start.col - offset, offset: start.offset - offset },
                //                                     end: start
                //                                 });
                //                                 const isProof = preLink == "`" + settings.beginProof + "`@";
                //                                 if (isProof) {
                //                                     proofs.push(backlink);
                //                                 }
                //                             }
                //                         }
                //                     })
                //                 );
                //                 // if (proofs.length > 1) {
                //                 new BacklinkModal(this.app, this.plugin, proofs, 0, 0).open();
                //                 // }
                //             }

                //         }
                //     })
                // })
                menu.showAtMouseEvent(event);
            }
        );
    }

    getLineNumber(view: MarkdownView, cache: CachedMetadata | null, event: MouseEvent): number | undefined {
        const info = this.context.getSectionInfo(this.containerEl);
        let lineNumber = info?.lineStart;
        if (lineNumber === undefined) {
            if (isEditingView(view)) {
                let pos = view.editor.cm?.posAtDOM(this.containerEl);
                if (pos !== undefined && cache) {
                    lineNumber = getSectionCacheFromPos(cache, pos, "callout")?.position.start.line;
                }
                if (lineNumber === undefined && cache) {
                    const pos = view.editor.cm?.posAtCoords(event) ?? view.editor.cm?.posAtCoords(event, false);
                    if (pos !== undefined) {
                        lineNumber = getSectionCacheFromPos(cache, pos, "callout")?.position.start.line;
                    }
                }
            } else {
                // what can I do in reading view??
            }
        }
        return lineNumber;
    }

    getBacklinks(event: MouseEvent): Backlink[] | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const cache = this.app.metadataCache.getFileCache(this.currentFile);
        if (!view || !cache) return null;

        const lineNumber = this.getLineNumber(view, cache, event);
        if (lineNumber == undefined) return null;

        const backlinksToNote = this.plugin.oldLinkMap.invMap.get(this.currentFile.path); // backlinks to the note containing this math callout
        const backlinks: Backlink[] = [] // backlinks to this math callout
        if (backlinksToNote) {
            for (const backlink of backlinksToNote) {
                const sourceCache = this.app.metadataCache.getCache(backlink);
                sourceCache?.links
                    ?.forEach((link: LinkCache) => {
                        const { subpath } = parseLinktext(link.link);
                        const subpathResult = resolveSubpath(cache, subpath);
                        if (subpathResult?.type == "block" && subpathResult.block.position.start.line == lineNumber) {
                            backlinks.push({ sourcePath: backlink, position: link.position });
                        }
                    })
            }
        }
        return backlinks;
    }
}


export function insertMathCalloutCallback(plugin: MathBooster, editor: Editor, config: MathSettings, currentFile: TFile) {
    const selection = editor.getSelection();
    const cursorPos = editor.getCursor();
    const resolvedSettings = resolveSettings(config, plugin, currentFile);
    const title = formatTitle(plugin, resolvedSettings);

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
