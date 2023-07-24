import { SmartCalloutTitleInner } from 'smart_callouts';
import { SmartCalloutModal } from 'modals';
import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, TFile } from "obsidian";
import { MATH_SETTINGS_KEYS, MathSettings } from 'settings';
import { TheoremLikeEnv, getTheoremLikeEnv } from 'env';
import LanguageManager from 'language';
import { getCurrentMarkdown, increaseQuoteLevel, renderTextWithMath } from 'utils';
import MathPlugin from 'main';

export class SmartCallout extends MarkdownRenderChild {
    env: TheoremLikeEnv;
    renderedTitleElements: (HTMLElement | string)[];

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathPlugin, public config: MathSettings,) {
        super(containerEl);
        this.env = getTheoremLikeEnv(this.config.type);
    }

    async resolveSettings(currentFile: TFile) {
        await this.app.fileManager.processFrontMatter(
            currentFile,
            (frontmatter) => {
                this.config = Object.assign({}, this.plugin.settings, frontmatter.math, this.config);
            }
        );
    }

    formatTitle(): string {
        let title = this.env.printedNames[this.config.lang as string];
        if (this.config.number) {
            let numberString = '';
            if (this.config.number == 'auto') {
                if (this.config.autoIndex !== undefined) {
                    numberString = `${+this.config.autoIndex + +this.config.number_init}`;
                }
            } else {
                numberString = this.config.number;
            }
            if (numberString) {
                title += ` ${this.config.number_prefix}${numberString}${this.config.number_suffix}`;
            }
        }
        if (this.config.title) {
            title += ` (${this.config.title})`;
        }
        return title;
    }

    async renderTitle(): Promise<void> {
        this.renderedTitleElements = await renderTextWithMath(this.formatTitle());
    }

    onload() {
        let titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        titleInner?.replaceChildren(...this.renderedTitleElements);
        this.containerEl.classList.add("math-callout-" + this.config.lang);
        this.containerEl.classList.add("math-callout-" + this.config.type);
    }
}




export function insertMathCalloutCallback(editor: Editor, config: MathSettings) {
    let selection = editor.getSelection();
    let cursorPos = editor.getCursor();
    if (selection) {
        editor.replaceSelection(
            `> [!math|${JSON.stringify(config)}] \n`
            + increaseQuoteLevel(selection)
        );
    } else {
        editor.replaceRange(
            `> [!math|${JSON.stringify(config)}] \n> `,
            cursorPos
        )
    }
    cursorPos.line += 1;
    cursorPos.ch = 2;
    editor.setCursor(cursorPos);
}



export function sortedAutoNumberedMathCallouts(cache: CachedMetadata) {
    let calloutCaches = cache.sections?.filter(
        (sectionCache) => sectionCache.type == "callout"
    );
    if (calloutCaches) {
        let autoNumberedCallouts = [];
        for (let calloutCache of calloutCaches) {
            let { start, end } = calloutCache.position;
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const editor = view?.editor;
            let settings = readMathCalloutMetadata(editor, start.line);
            if (settings && settings.number == 'auto') {
                autoNumberedCallouts.push(
                    { cache: calloutCache, settings: settings }
                );
            }
        }
        autoNumberedCallouts.sort(
            (callout1, callout2) => {
                return callout1.cache.position.start.line - callout2.cache.position.start.line;
            }
        )
        return autoNumberedCallouts;
    }
}



export function autoIndexMathCallouts(cache: CachedMetadata, editor: Editor) {
    let callouts = sortedAutoNumberedMathCallouts(cache);
    callouts?.forEach((callout, index) => {
        callout.settings.autoIndex = index;
        overwriteMathCalloutMetadata(
            editor,
            callout.cache.position.start.line,
            callout.settings,
        )
    });

}





export function matchMathCallout(editor: Editor, lineNumber: number): RegExpExecArray | null {
    const firstLine = editor.getLine(lineNumber);
    if (firstLine) {
        return (/\> *\[\! *math *\|(.*)\]/).exec(firstLine)
    }
    return null;
}


export function readMathCalloutMetadata(editor: Editor, lineNumber: number): MathSettings | undefined {
    const matchResult = matchMathCallout(editor, lineNumber);
    if (matchResult) {
        let settings = JSON.parse(matchResult[1]) as MathSettings;
        return settings;
    }
}


export function overwriteMathCalloutMetadata(editor: Editor, lineNumber: number, settings: MathSettings) {
    const matchResult = matchMathCallout(editor, lineNumber);
    if (!matchResult) {
        throw Error(`Math callout not found at line ${lineNumber}, could not overwrite`);
    }

    editor.setLine(
        lineNumber,
        `> [!math|${JSON.stringify(settings)}] `,
    );
}

