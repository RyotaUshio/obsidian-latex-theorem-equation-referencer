import { App, CachedMetadata, Editor, MarkdownView, Pos, SectionCache, TFile } from 'obsidian';

import MathPlugin from 'main';
import { DEFAULT_SETTINGS, MathSettings, NumberStyle, findNearestAncestorContextSettings } from 'settings';
import { getBlockIdsWithBacklink, locToEditorPosition, readMathCalloutSettings, getLinksAndEmbedsInFile, resolveSettings, formatTitle, readMathCalloutSettingsAndTitle, CONVERTER, matchMathCallout, splitIntoLines } from 'utils';


type CalloutInfo = { cache: SectionCache, settings: MathSettings };
type EquationInfo = { cache: SectionCache, manualTag?: string };


abstract class SinceFileIndexer {

    constructor(public app: App, public plugin: MathPlugin, public file: TFile) { }

    abstract setLine(lineNumber: number, text: string): Promise<void>;
    abstract getLine(lineNumber: number): Promise<string>;
    abstract getRange(position: Pos): Promise<string>;
    abstract isSafe(lineNumber: number): boolean;

    async sortedBlocks<BlockInfo extends { cache: SectionCache }>(
        cache: CachedMetadata,
        type: "callout" | "math",
        addSection: (sections: BlockInfo[], sectionCache: SectionCache) => Promise<void>,
    ): Promise<BlockInfo[]> {

        let sectionCaches = cache.sections?.filter(
            (sectionCache) => sectionCache.type == type
        );
        let sections: BlockInfo[] = [];
        if (sectionCaches) {
            for (let sectionCache of sectionCaches) {
                await addSection(sections, sectionCache);
            }
            sections.sort(
                (section1, section2) => {
                    return section1.cache.position.start.line - section2.cache.position.start.line;
                }
            )
        }
        return sections;
    }

    async sortedMathCallouts(cache: CachedMetadata): Promise<CalloutInfo[]> {
        return await this.sortedBlocks<CalloutInfo>(
            cache, "callout",
            async (sections, sectionCache) => {
                let settings = readMathCalloutSettings(
                    await this.getLine(sectionCache.position.start.line)
                );
                if (settings) {
                    sections.push(
                        { cache: sectionCache, settings: settings }
                    );
                }
            }
        );
    }

    async sortedEquations(cache: CachedMetadata): Promise<EquationInfo[]> {
        // based on backlinks, not blockIDs.
        let linkedBlockIds = getBlockIdsWithBacklink(this.file.path, this.app);
        return this.sortedBlocks<EquationInfo>(
            cache, "math",
            async (sections, sectionCache) => {
                if (sectionCache.id && linkedBlockIds.contains(sectionCache.id)) {
                    let text = await this.getRange(sectionCache.position);
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

    async overwriteMathCalloutSettings(lineNumber: number, settings: MathSettings, title?: string) {
        const matchResult = matchMathCallout(await this.getLine(lineNumber));
        if (!matchResult) {
            throw Error(`Math callout not found at line ${lineNumber}, could not overwrite`);
        }
        this.setLine(
            lineNumber,
            `> [!math|${JSON.stringify(settings)}] ${title ?? ""}`,
        );
    }    

    async run(cache: CachedMetadata) {
        let callouts = await this.sortedMathCallouts(cache);
        let equations = await this.sortedEquations(cache);

        let mathLinkCache: Record<string, string> = {}; // {[id]: [mathLink], ...}

        let index = 0;
        for (let callout of callouts) {
            if (callout.settings.number == 'auto') {
                callout.settings.autoIndex = index++;
            }
            let resolvedSettings = resolveSettings(callout.settings, this.plugin, this.file);
            let newTitle = formatTitle(resolvedSettings);
            let oldSettingsAndTitle = readMathCalloutSettingsAndTitle(
                await this.getLine(callout.cache.position.start.line)
            );
            if (oldSettingsAndTitle) {
                let { settings, title } = oldSettingsAndTitle;
                let lineNumber = callout.cache.position.start.line;
                if (this.isSafe(lineNumber) && JSON.stringify(settings) != JSON.stringify(callout.settings) || title != newTitle) {
                    await this.overwriteMathCalloutSettings(
                        lineNumber,
                        callout.settings,
                        newTitle,
                    )
                }
                let id = callout.cache.id;
                if (id) {
                    mathLinkCache[id] = newTitle;
                }
            }
        }

        let contextSettings = findNearestAncestorContextSettings(this.plugin, this.file);
        let style = contextSettings?.eq_number_style ?? DEFAULT_SETTINGS.eq_number_style as NumberStyle;
        let equationNumber = 1;
        for (let i = 0; i < equations.length; i++) {
            let equation = equations[i];
            let id = equation.cache.id;
            if (id) {
                if (equation.manualTag) {
                    mathLinkCache[id] = `(${equation.manualTag})`;
                } else {
                    mathLinkCache[id] = "(" + CONVERTER[style](equationNumber) + ")";
                    equationNumber++;
                }
            }
        }

        this.plugin.mathLinksAPI.update(
            this.file.path,
            { "mathLink-blocks": mathLinkCache }
        );
    }
}

export class ActiveFileIndexer extends SinceFileIndexer {
    editor: Editor;

    constructor(public app: App, public plugin: MathPlugin, view: MarkdownView) {
        super(app, plugin, view.file);
        this.editor = view.editor;
    }

    async setLine(lineNumber: number, text: string): Promise<void> {
        this.editor.setLine(lineNumber, text);
    }

    async getLine(lineNumber: number): Promise<string> {
        return this.editor.getLine(lineNumber);
    }

    async getRange(position: Pos): Promise<string> {
        let from = locToEditorPosition(position.start);
        let to = locToEditorPosition(position.end);
        let text = this.editor.getRange(from, to);
        return text;
    }

    isSafe(lineNumber: number): boolean {
        let cursorPos = this.editor.getCursor();
        if (cursorPos.line == lineNumber) {
            return false;
        }
        return true;
    }
}


export class NonActiveFileIndexer extends SinceFileIndexer {

    async setLine(lineNumber: number, text: string): Promise<void> {
        this.app.vault.process(this.file, (data: string): string => {
            let lines = splitIntoLines(data);
            lines[lineNumber] = text;
            return lines.join('\n');
        })
    }

    async getLine(lineNumber: number): Promise<string> {
        let data = await this.app.vault.cachedRead(this.file);
        let lines = splitIntoLines(data);
        return lines[lineNumber];
    }

    async getRange(position: Pos): Promise<string> {
        let content = await this.app.vault.cachedRead(this.file);
        return content.slice(position.start.offset, position.end.offset);
    }

    isSafe(lineNumber: number): boolean {
        return true;
    }
}