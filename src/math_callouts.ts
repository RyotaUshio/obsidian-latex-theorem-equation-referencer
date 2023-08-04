import { MathCalloutModal } from 'modals';
import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, TFile, Menu, setIcon } from "obsidian";
import { MATH_SETTINGS_KEYS, MathSettings, findNearestAncestorContextSettings } from 'settings';
import { ENVs_MAP, TheoremLikeEnv, getTheoremLikeEnv } from 'env';
import LanguageManager from 'language';
import { generateBlockID, getCurrentMarkdown, increaseQuoteLevel, renderTextWithMath } from 'utils';
import MathPlugin, { VAULT_ROOT } from 'main';
import { formatTitle, formatTitleWithoutSubtitle, matchMathCallout, overwriteMathCalloutMetadata, resolveSettings } from 'autoIndex';

export class MathCallout extends MarkdownRenderChild {
    env: TheoremLikeEnv;
    renderedTitleElements: (HTMLElement | string)[];

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathPlugin, public config: MathSettings, public currentFile: TFile) {
        super(containerEl);
        this.env = getTheoremLikeEnv(this.config.type);
        this.config = resolveSettings(this.config, this.plugin, this.currentFile);
    }

    async setRenderedTitleElements() {
        // ex) "Theorem 1.1", not "Theorem 1.1 (Cauchy-Schwarz)"
        let titleWithoutSubtitle = await renderTextWithMath(formatTitleWithoutSubtitle(this.config));
        this.renderedTitleElements = [
            ...titleWithoutSubtitle
        ];
        if (this.config.title) {
            // ex) "(Cauchy-Schwarz)"
            let subtitle = await renderTextWithMath(`(${this.config.title})`);
            let subtitleEl = createSpan({ cls: "math-callout-subtitle" });
            subtitleEl.replaceChildren(...subtitle)
            this.renderedTitleElements.push(" ", subtitleEl);
        }
    }

    onload() {
        // make sure setRenderedTitleElements() is called beforehand
        let titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        titleInner?.replaceChildren(...this.renderedTitleElements);

        // add classes for CSS snippets
        this.containerEl.classList.add("math-callout-" + this.config.lang);
        this.containerEl.classList.add("math-callout-" + this.config.type);

        // click the title block (div.callout-title) to edit settings
        let title = this.containerEl.querySelector<HTMLElement>('.callout-title');
        if (title) {
            title.onclick = async () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const editor = view?.editor;
                if (editor) {
                    let modal = new MathCalloutModal(
                        this.app,
                        this.plugin,
                        view, 
                        (settings) => {
                            // new title is set here, but it will soon be overwritten by this.registerEvent(this.app.metadataCache.on('changed', ...
                            // so the title here is only temporary
                            let resolvedSettings = resolveSettings(settings, this.plugin, this.currentFile);
                            if (settings.number == 'auto') {
                                resolvedSettings["autoIndex"] = this.config.autoIndex;
                            }
                            let title = formatTitle(resolvedSettings);
                            overwriteMathCalloutMetadata(editor, editor.getCursor().line, settings, title, true);
                        },
                        "Confirm", 
                        "Edit Math Callout Settings", 
                        this.config,
                    );
                    modal.resolveDefaultSettings(view.file);
                    modal.open();
                }

            }
        }
    }
}


export function insertMathCalloutCallback(app: App, plugin: MathPlugin, editor: Editor, config: MathSettings, currentFile: TFile) {
    let selection = editor.getSelection();
    let cursorPos = editor.getCursor();
    let id = generateBlockID(app);
    let resolvedSettings = resolveSettings(config, plugin, currentFile);
    let title = formatTitle(resolvedSettings);

    if (selection) {
        editor.replaceSelection(
            `> [!math|${JSON.stringify(config)}] ${title}\n`
            + increaseQuoteLevel(selection)
            + `\n^${id}`
        );
    } else {
        editor.replaceRange(
            `> [!math|${JSON.stringify(config)}] ${title}\n> \n^${id}`,
            cursorPos
        )
    }
    cursorPos.line += 1;
    cursorPos.ch = 2;
    editor.setCursor(cursorPos);
}


// export function overwriteMathCalloutMetadata(editor: Editor, lineNumber: number, settings: MathSettings, title?: string) {
//     const matchResult = matchMathCallout(editor.getLine(lineNumber));
//     if (!matchResult) {
//         throw Error(`Math callout not found at line ${lineNumber}, could not overwrite`);
//     }
//     editor.setLine(
//         lineNumber,
//         `> [!math|${JSON.stringify(settings)}] ${title ?? ""}`,
//     );
// }
