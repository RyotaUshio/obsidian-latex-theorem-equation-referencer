import { App, CachedMetadata, Editor, ExtraButtonComponent, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Menu, Notice, TFile } from "obsidian";

import MathBooster from './main';
import { TheoremCalloutModal } from './modals';
import { TheoremCalloutSettings, MathSettings, ResolvedMathSettings } from './settings/settings';
import { increaseQuoteLevel, renderTextWithMath, formatTitle, formatTitleWithoutSubtitle, resolveSettings, splitIntoLines, isEditingView, getSectionCacheOfDOM, getSectionCacheFromMouseEvent, getBacklinks } from './utils';
import { AutoNoteIndexer } from './indexer';
import { Backlink, BacklinkModal } from "backlinks";


export class TheoremCallout extends MarkdownRenderChild {
    settings: TheoremCalloutSettings;
    resolvedSettings: ResolvedMathSettings;
    renderedTitleElements: (HTMLElement | string)[];

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, settings: MathSettings, public currentFile: TFile, public context: MarkdownPostProcessorContext) {
        super(containerEl);
        this.settings = settings;
        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
    }

    async setRenderedTitleElements() {
        // ex) "Theorem 1.1", not "Theorem 1.1 (Cauchy-Schwarz)"
        const titleWithoutSubtitle = await renderTextWithMath(formatTitleWithoutSubtitle(this.plugin, this.currentFile, this.resolvedSettings));
        this.renderedTitleElements = [
            ...titleWithoutSubtitle
        ];
        if (this.resolvedSettings.title) {
            // ex) "(Cauchy-Schwarz)"
            const subtitle = await renderTextWithMath(`(${this.resolvedSettings.title})`);
            const subtitleEl = createSpan({ cls: "theorem-callout-subtitle" });
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
        this.containerEl.classList.add("theorem-callout");
        const profile = this.plugin.extraSettings.profiles[this.resolvedSettings.profile];
        for (const tag of profile.meta.tags) {
            this.containerEl.classList.add("theorem-callout-" + tag);
        }
        this.containerEl.classList.add("theorem-callout-" + this.resolvedSettings.type);
        this.containerEl.toggleClass(`theorem-callout-${this.resolvedSettings.theoremCalloutStyle.toLowerCase()}`, this.resolvedSettings.theoremCalloutStyle != "Custom");
        this.containerEl.toggleClass("theorem-callout-font-family-inherit", this.resolvedSettings.theoremCalloutStyle != "Custom" && this.resolvedSettings.theoremCalloutFontInherit);

        // click the title block (div.callout-title) to edit settings
        const button = new ExtraButtonComponent(this.containerEl)
            .setIcon("settings-2")
            .setTooltip("Edit theorem callout settings");
        button.extraSettingsEl.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const cache = this.app.metadataCache.getFileCache(this.currentFile);
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const editor = view?.editor;
            if (editor) {
                // Make sure to get the line number BEFORE opening the modal!!
                const lineNumber = this.getLineNumber(view, cache, ev);

                new TheoremCalloutModal(
                    this.app,
                    this.plugin,
                    view.file,
                    async (settings) => {
                        this.settings = settings;
                        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
                        const title = formatTitle(this.plugin, this.currentFile, this.resolvedSettings);
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
                    "Edit theorem callout settings",
                    this.settings,
                ).open();
            }
        });
        button.extraSettingsEl.classList.add("theorem-callout-setting-button");

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

    getLineNumber(view: MarkdownView, cache: CachedMetadata | null, event: MouseEvent): number | undefined {
        const info = this.context.getSectionInfo(this.containerEl);
        let lineNumber = info?.lineStart;
        if (typeof lineNumber == "number") {
            return lineNumber;
        }

        if (isEditingView(view) && view.editor.cm && cache) {
            let sec = getSectionCacheOfDOM(this.containerEl, "callout", view.editor.cm, cache);
            lineNumber = sec?.position.start.line;
            if (typeof lineNumber == "number") {
                return lineNumber;
            }

            sec = getSectionCacheFromMouseEvent(event, "callout", view.editor.cm, cache)
            lineNumber = sec?.position.start.line;
            if (typeof lineNumber == "number") {
                return lineNumber;
            }
        } else {
            // what can I do in reading view??
        }
    }

    getBacklinks(event: MouseEvent): Backlink[] | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const cache = this.app.metadataCache.getFileCache(this.currentFile);
        if (!view || !cache) return null;

        const lineNumber = this.getLineNumber(view, cache, event);
        if (typeof lineNumber != "number") return null;

        return getBacklinks(this.app, this.plugin, this.currentFile, cache, (block) => block.position.start.line == lineNumber);
    }
}


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
