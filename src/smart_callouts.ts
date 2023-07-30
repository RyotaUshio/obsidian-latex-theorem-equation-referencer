import { SmartCalloutModal } from 'modals';
import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, TFile, Menu, setIcon } from "obsidian";
import { MATH_SETTINGS_KEYS, MathSettings, findNearestAncestorContextSettings } from 'settings';
import { ENVs_MAP, TheoremLikeEnv, getTheoremLikeEnv } from 'env';
import LanguageManager from 'language';
import { generateBlockID, getCurrentMarkdown, increaseQuoteLevel, renderTextWithMath } from 'utils';
import MathPlugin, { VAULT_ROOT } from 'main';
import { StringStream } from 'codemirror';

export class SmartCallout extends MarkdownRenderChild {
    env: TheoremLikeEnv;
    renderedTitleElements: (HTMLElement | string)[];

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathPlugin, public config: MathSettings, public currentFile: TFile) {
        super(containerEl);
        this.env = getTheoremLikeEnv(this.config.type);
        this.config = resolveSettings(this.config, this.plugin, this.currentFile);
    }

    // async renderTitle(): Promise<void> {
    //     this.renderedTitleElements = await renderTextWithMath(formatTitle(this.config));
    // }

    onload() {
        let titleInner = this.containerEl.querySelector<HTMLElement>('.callout-title-inner');
        // titleInner?.replaceChildren(...this.renderedTitleElements);

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
                    let modal = new SmartCalloutModal(
                        this.app,
                        this.plugin,
                        (settings) => {
                            // new title is set here, but it will soon be overwritten by this.registerEvent(this.app.metadataCache.on('changed', ...
                            // so the title here is only temporary
                            let resolvedSettings = resolveSettings(settings, this.plugin, this.currentFile);
                            if (settings.number == 'auto') {
                                resolvedSettings["autoIndex"] = this.config.autoIndex;
                            }
                            let title = formatTitle(resolvedSettings);
                            overwriteMathCalloutMetadata(editor, editor.getCursor().line, settings, title);
                        },
                        this.config, 
                        "Confirm"
                    );
                    modal.resolveDefaultSettings(view.file);
                    modal.open();
                }

            }
        }
    }
}




export function insertMathCalloutCallback(app: App, editor: Editor, config: MathSettings) {
    let selection = editor.getSelection();
    let cursorPos = editor.getCursor();
    let id = generateBlockID(app);

    if (selection) {
        editor.replaceSelection(
            `> [!math|${JSON.stringify(config)}] \n`
            + increaseQuoteLevel(selection)
            + `\n\n^${id}`
        );
    } else {
        editor.replaceRange(
            `> [!math|${JSON.stringify(config)}] \n> \n\n^${id}`,
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
            let settings = readMathCalloutMetadata(editor.getLine(start.line));
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



export function autoIndexMathCallouts(cache: CachedMetadata, editor: Editor, currentFile: TFile, plugin: MathPlugin) {
    let callouts = sortedAutoNumberedMathCallouts(cache);

    let mathLinkCache: Record<string, string> = {}; // {[id]: [mathLink], ...}

    callouts?.forEach((callout, index) => {
        callout.settings.autoIndex = index;
        let resolvedSettings = resolveSettings(callout.settings, plugin, currentFile);
        let newTitle = formatTitle(resolvedSettings);
        let oldSettingsAndTitle = readMathCalloutSettingsAndTitle(editor.getLine(callout.cache.position.start.line));
        if (oldSettingsAndTitle) {
            let {settings, title} = oldSettingsAndTitle;
            if (JSON.stringify(settings) != JSON.stringify(callout.settings) || title != newTitle) {
                overwriteMathCalloutMetadata(
                    editor,
                    callout.cache.position.start.line,
                    callout.settings,
                    newTitle,
                )        
            }
            let id = callout.cache.id;
            if (id) {
                mathLinkCache[id] = newTitle;
            }
        }
    });

    plugin.app.fileManager.processFrontMatter(
        currentFile, 
        (frontmatter) => {
        if (
            Object.keys(mathLinkCache).length 
            && JSON.stringify(frontmatter["mathLinks-block"]) != JSON.stringify(mathLinkCache)
        ) {
            frontmatter["mathLinks-block"] = mathLinkCache;
        }
    });
}



export const MATH_CALLOUT_PATTERN = /\> *\[\! *math *\|(.*)\](.*)/;

// export function matchMathCallout(editor: Editor, lineNumber: number): RegExpExecArray | null {
//     const firstLine = editor.getLine(lineNumber);
//     if (firstLine) {
//         return MATH_CALLOUT_PATTERN.exec(firstLine)
//     }
//     return null;
// }

export function matchMathCallout(line: string): RegExpExecArray | null {
    if (line) {
        return MATH_CALLOUT_PATTERN.exec(line)
    }
    return null;
}



export function readMathCalloutSettingsAndTitle(line: string): {settings:MathSettings, title:string} | undefined {
    const matchResult = matchMathCallout(line);
    if (matchResult) {
        let settings = JSON.parse(matchResult[1]) as MathSettings;
        let title = matchResult[2].trim();
        return {settings, title};
    }
}

export function readMathCalloutMetadata(line: string): MathSettings | undefined {    // const matchResult = matchMathCallout(editor, lineNumber);
    let result = readMathCalloutSettingsAndTitle(line);
    if (result) {
        return result.settings;
    }    
}

export function readMathCalloutTitle(line: string): string | undefined {    // const matchResult = matchMathCallout(editor, lineNumber);
    let result = readMathCalloutSettingsAndTitle(line);
    if (result) {
        return result.title;
    }    
}

export function overwriteMathCalloutMetadata(editor: Editor, lineNumber: number, settings: MathSettings, title?: string) {
    const matchResult = matchMathCallout(editor.getLine(lineNumber));
    if (!matchResult) {
        throw Error(`Math callout not found at line ${lineNumber}, could not overwrite`);
    }
    editor.setLine(
        lineNumber,
        `> [!math|${JSON.stringify(settings)}] ${title ?? ""}`,
    );
}

export function resolveSettings(settings: MathSettings, plugin: MathPlugin, currentFile: TFile) {
    // Resolves settings. Does not overwride, but returns a new settings object.
    let contextSettings = findNearestAncestorContextSettings(plugin, currentFile);
    return Object.assign({}, plugin.settings[VAULT_ROOT], contextSettings, settings);
}

export function formatTitle(settings: MathSettings): string {
    let env = ENVs_MAP[settings.type];

    let title = '';
    if (settings.rename && settings.rename[env.id]) {
        title = settings.rename[env.id] as string;
    } else {
        title = env.printedNames[settings.lang as string];
    }
    if (settings.number) {
        let numberString = '';
        if (settings.number == 'auto') {
            if (settings.autoIndex !== undefined) {
                settings.number_init = settings.number_init ?? 1;
                numberString = `${+settings.autoIndex + +settings.number_init}`;
            }
        } else {
            numberString = settings.number;
        }
        if (numberString) {
            title += ` ${settings.number_prefix}${numberString}${settings.number_suffix}`;
        }
    }
    if (settings.title) {
        title += ` (${settings.title})`;
    }
    return title;
}
