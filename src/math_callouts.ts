import { App, CachedMetadata, Editor, ExtraButtonComponent, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Notice, TFile } from "obsidian";

import MathBooster from './main';
import { MathCalloutModal } from './modals';
import { MathCalloutSettings, MathSettings, ResolvedMathSettings } from './settings/settings';
import { increaseQuoteLevel, renderTextWithMath, formatTitle, formatTitleWithoutSubtitle, resolveSettings, splitIntoLines, getSectionCacheFromPos, readMathCalloutSettings, isEditingView } from './utils';
import { AutoNoteIndexer } from './indexer';


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
