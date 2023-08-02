import { ENVs_MAP } from "env";
import MathPlugin, { VAULT_ROOT } from "main";
import { CachedMetadata, Editor, Loc, MarkdownView, SectionCache, TFile } from "obsidian";
import { MathSettings, findNearestAncestorContextSettings } from "settings";
import { locToEditorPosition } from "utils";


type CalloutInfo = { cache: SectionCache, settings: MathSettings };
type EquationInfo = { cache: SectionCache, manualTag?: string };


function sortedBlocks<BlockInfo extends { cache: SectionCache }>(
    editor: Editor,
    cache: CachedMetadata,
    type: "callout" | "math",
    addSection: (sections: BlockInfo[], sectionCache: SectionCache, editor: Editor) => void,
): BlockInfo[] {

    let sectionCaches = cache.sections?.filter(
        (sectionCache) => sectionCache.type == type
    );
    let sections: BlockInfo[] = [];
    if (sectionCaches) {
        for (let sectionCache of sectionCaches) {
            addSection(sections, sectionCache, editor);
        }
        sections.sort(
            (section1, section2) => {
                return section1.cache.position.start.line - section2.cache.position.start.line;
            }
        )
    }
    return sections;
}


export function sortedMathCallouts(editor: Editor, cache: CachedMetadata): CalloutInfo[] {
    return sortedBlocks<CalloutInfo>(
        editor, cache, "callout",
        (sections, sectionCache, editor) => {
            let settings = readMathCalloutMetadata(editor.getLine(sectionCache.position.start.line));
            if (settings && settings.number == 'auto') {
                sections.push(
                    { cache: sectionCache, settings: settings }
                );
            }
        }
    );
}


export function sortedEquations(editor: Editor, cache: CachedMetadata): EquationInfo[] {
    return sortedBlocks<EquationInfo>(
        editor, cache, "math",
        (sections, sectionCache, editor) => {
            if (sectionCache.id) {
                let from = locToEditorPosition(sectionCache.position.start);
                let to = locToEditorPosition(sectionCache.position.end);
                let text = editor.getRange(from, to);
                let tagMatch = text.match(/\\tag\{(.*)\}/);
                if (tagMatch) {
                    sections.push({ cache: sectionCache, manualTag: tagMatch[1] });
                } else {
                    sections.push({ cache: sectionCache });
                }
            }
        }
    );
}


export function autoIndex(cache: CachedMetadata, editor: Editor, currentFile: TFile, plugin: MathPlugin) {
    let callouts = sortedMathCallouts(editor, cache);
    let equations = sortedEquations(editor, cache);

    let mathLinkCache: Record<string, string> = {}; // {[id]: [mathLink], ...}

    callouts.forEach((callout, index) => {
        callout.settings.autoIndex = index;
        let resolvedSettings = resolveSettings(callout.settings, plugin, currentFile);
        let newTitle = formatTitle(resolvedSettings);
        let oldSettingsAndTitle = readMathCalloutSettingsAndTitle(editor.getLine(callout.cache.position.start.line));
        if (oldSettingsAndTitle) {
            let { settings, title } = oldSettingsAndTitle;
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

    let equationNumber = 1;
    for (let i = 0; i < equations.length; i++) {
        let equation = equations[i];
        let id = equation.cache.id;
        if (id) {
            if (equation.manualTag) {
                mathLinkCache[id] = `(${equation.manualTag})`;
            } else {
                mathLinkCache[id] =  `(${equationNumber})`;
                equationNumber++;
            }
        }
    }

    plugin.app.fileManager.processFrontMatter(
        currentFile,
        (frontmatter) => {
            if (
                Object.keys(mathLinkCache).length
                && JSON.stringify(frontmatter["mathLink-blocks"]) != JSON.stringify(mathLinkCache)
            ) {
                frontmatter["mathLink-blocks"] = mathLinkCache;
            }
        });
}



export const MATH_CALLOUT_PATTERN = /\> *\[\! *math *\|(.*)\](.*)/;


export function matchMathCallout(line: string): RegExpExecArray | null {
    if (line) {
        return MATH_CALLOUT_PATTERN.exec(line)
    }
    return null;
}


export function readMathCalloutSettingsAndTitle(line: string): { settings: MathSettings, title: string } | undefined {
    const matchResult = matchMathCallout(line);
    if (matchResult) {
        let settings = JSON.parse(matchResult[1]) as MathSettings;
        let title = matchResult[2].trim();
        return { settings, title };
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
