import { App, Editor, ExtraButtonComponent, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Notice, TFile } from "obsidian";

import MathBooster from './main';
import { MathCalloutModal } from './modals';
import { MathSettings, ResolvedMathSettings } from './settings/settings';
import { TheoremLikeEnv, getTheoremLikeEnv } from './env';
import { increaseQuoteLevel, renderTextWithMath, formatTitle, formatTitleWithoutSubtitle, resolveSettings, splitIntoLines, getSectionCacheFromPos, readMathCalloutSettings } from './utils';
import { AutoNoteIndexer } from './indexer';


export class MathCallout extends MarkdownRenderChild {
    settings: MathSettings;
    resolvedSettings: ResolvedMathSettings;
    env: TheoremLikeEnv;
    renderedTitleElements: (HTMLElement | string)[];

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathBooster, settings: MathSettings, public currentFile: TFile, public context: MarkdownPostProcessorContext) {
        super(containerEl);
        this.settings = settings;
        this.env = getTheoremLikeEnv(this.settings.type);
        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
    }

    async setRenderedTitleElements() {
        // ex) "Theorem 1.1", not "Theorem 1.1 (Cauchy-Schwarz)"
        const titleWithoutSubtitle = await renderTextWithMath(formatTitleWithoutSubtitle(this.resolvedSettings));
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
        this.containerEl.classList.add("math-callout-" + this.resolvedSettings.lang);
        this.containerEl.classList.add("math-callout-" + this.resolvedSettings.type);
        this.containerEl.toggleClass(`math-callout-${this.resolvedSettings.mathCalloutStyle}`, this.resolvedSettings.mathCalloutStyle != "custom");
        this.containerEl.toggleClass("math-callout-font-family-inherit", this.resolvedSettings.mathCalloutStyle != "custom" && this.resolvedSettings.mathCalloutFontInherit);

        // click the title block (div.callout-title) to edit settings
        const button = new ExtraButtonComponent(this.containerEl)
            .setIcon("settings-2")
            .setTooltip("Edit math callout settings");
        button.extraSettingsEl.addEventListener("click", (ev) => {
            const cache = this.app.metadataCache.getFileCache(this.currentFile);
            ev.stopPropagation();
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const editor = view?.editor;
            if (editor) {
                const modal = new MathCalloutModal(
                    this.app,
                    this.plugin,
                    view.file,
                    async (settings) => {
                        this.settings = settings;
                        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
                        const title = formatTitle(this.resolvedSettings);
                        const indexer = (new AutoNoteIndexer(this.app, this.plugin, view.file)).getIndexer();
                        const info = this.context.getSectionInfo(this.containerEl);
                        let lineNumber = info?.lineStart;
                        if (lineNumber === undefined && view.getMode() == "source") { // Live preview or source mode
                            let pos = editor.cm?.posAtDOM(this.containerEl);
                            if (pos !== undefined && cache) {
                                lineNumber = getSectionCacheFromPos(cache, pos, "callout")?.position.start.line;
                            }
                            if (lineNumber === undefined && cache) {
                                const pos = editor.cm?.posAtCoords(ev) ?? editor.cm?.posAtCoords(ev, false);
                                if (pos !== undefined) {
                                    lineNumber = getSectionCacheFromPos(cache, pos, "callout")?.position.start.line;
                                }
                            }
                        }
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
                );
                modal.resolveDefaultSettings(view.file);
                modal.open();
            }
        });
        button.extraSettingsEl.classList.add("math-callout-setting-button");

    }
}


export function insertMathCalloutCallback(plugin: MathBooster, editor: Editor, config: MathSettings, currentFile: TFile) {
    const selection = editor.getSelection();
    const cursorPos = editor.getCursor();
    const resolvedSettings = resolveSettings(config, plugin, currentFile);
    const title = formatTitle(resolvedSettings);

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
