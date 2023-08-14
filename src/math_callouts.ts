import { App, Editor, ExtraButtonComponent, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, TFile } from "obsidian";

import MathBooster from './main';
import { MathCalloutModal } from './modals';
import { MathSettings, ResolvedMathSettings } from './settings/settings';
import { TheoremLikeEnv, getTheoremLikeEnv } from './env';
import { increaseQuoteLevel, renderTextWithMath, formatTitle, formatTitleWithoutSubtitle, resolveSettings, splitIntoLines, getSectionCacheFromPos } from './utils';
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
        let titleWithoutSubtitle = await renderTextWithMath(formatTitleWithoutSubtitle(this.resolvedSettings));
        this.renderedTitleElements = [
            ...titleWithoutSubtitle
        ];
        if (this.resolvedSettings.title) {
            // ex) "(Cauchy-Schwarz)"
            let subtitle = await renderTextWithMath(`(${this.resolvedSettings.title})`);
            let subtitleEl = createSpan({ cls: "math-callout-subtitle" });
            subtitleEl.replaceChildren(...subtitle)
            this.renderedTitleElements.push(" ", subtitleEl);
        }
        if (this.resolvedSettings.titleSuffix) {
            this.renderedTitleElements.push(this.resolvedSettings.titleSuffix);
        }
    }

    onload() {
        // make sure setRenderedTitleElements() is called beforehand
        let titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        titleInner?.replaceChildren(...this.renderedTitleElements);

        // add classes for CSS snippets
        this.containerEl.classList.add("math-callout");
        this.containerEl.classList.add("math-callout-" + this.resolvedSettings.lang);
        this.containerEl.classList.add("math-callout-" + this.resolvedSettings.type);
        this.containerEl.toggleClass(`math-callout-${this.resolvedSettings.mathCalloutStyle}`, this.resolvedSettings.mathCalloutStyle != "custom");
        this.containerEl.toggleClass("font-family-inherit", this.resolvedSettings.mathCalloutStyle != "custom" && this.resolvedSettings.mathCalloutFontInherit);

        // click the title block (div.callout-title) to edit settings
        let button = new ExtraButtonComponent(this.containerEl)
            .setIcon("settings-2")
            .setTooltip("Edit math callout settings");
        button.extraSettingsEl.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const editor = view?.editor;
            if (editor) {
                let modal = new MathCalloutModal(
                    this.app,
                    this.plugin,
                    view,
                    (settings) => {
                        this.settings = settings;
                        this.resolvedSettings = resolveSettings(this.settings, this.plugin, this.currentFile);
                        let title = formatTitle(this.resolvedSettings);
                        let indexer = (new AutoNoteIndexer(this.app, this.plugin, view.file)).getIndexer();
                        const info = this.context.getSectionInfo(this.containerEl);
                        let lineNumber = info?.lineStart;
                        if (lineNumber === undefined && view.getMode() == "source") { // Live preview or source mode
                            const pos = editor.cm?.posAtDOM(this.containerEl);
                            const cache = this.app.metadataCache.getFileCache(this.currentFile);
                            if (pos !== undefined && cache) {
                                lineNumber = getSectionCacheFromPos(cache, pos, "callout")?.position.start.line;
                            }
                        }
                        if (lineNumber !== undefined) {
                            indexer.calloutIndexer.overwriteSettings(lineNumber, this.settings, title);
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
    let selection = editor.getSelection();
    let cursorPos = editor.getCursor();
    let resolvedSettings = resolveSettings(config, plugin, currentFile);
    let title = formatTitle(resolvedSettings);

    if (selection) {
        let nLines = splitIntoLines(selection).length;
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
