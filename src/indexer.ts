import { App, CachedMetadata, Editor, MarkdownView, Pos, SectionCache, TFile, WorkspaceLeaf } from 'obsidian';

import MathPlugin from './main';
import { DEFAULT_SETTINGS, MathSettings, NumberStyle, findNearestAncestorContextSettings } from './settings/settings';
import { getBlockIdsWithBacklink, locToEditorPosition, readMathCalloutSettings, resolveSettings, formatTitle, readMathCalloutSettingsAndTitle, CONVERTER, matchMathCallout, splitIntoLines, removeFrom } from './utils';

type MathLinkBlocks = Record<string, string>;

type BlockType = "callout" | "math";
type CalloutInfo = { cache: SectionCache, settings: MathSettings };
type EquationInfo = { cache: SectionCache, manualTag?: string };


abstract class BlockIndexer<BlockInfo extends { cache: SectionCache }> {
    mathLinkBlocks: MathLinkBlocks;

    constructor(public noteIndexer: SingleNoteIndexer) {
        this.mathLinkBlocks = {};
    }

    abstract readonly blockType: BlockType;

    abstract addSection(sections: Readonly<BlockInfo>[], sectionCache: Readonly<SectionCache>): Promise<void>;
    abstract setMathLinks(blocks: readonly Readonly<BlockInfo>[]): Promise<void>;

    async sorted(cache: Readonly<CachedMetadata>): Promise<BlockInfo[]> {

        let sectionCaches = cache.sections?.filter(
            (sectionCache) => sectionCache.type == this.blockType
        );
        let sections: BlockInfo[] = [];
        if (sectionCaches) {
            for (let sectionCache of sectionCaches) {
                await this.addSection(sections, sectionCache);
            }
            sections.sort(
                (section1, section2) => {
                    return section1.cache.position.start.line - section2.cache.position.start.line;
                }
            )
        }
        return sections;
    }

    async run(cache: Readonly<CachedMetadata>): Promise<void> {
        const blocks = await this.sorted(cache);
        await this.setMathLinks(blocks);
    }
}

class MathCalloutIndexer extends BlockIndexer<CalloutInfo> {
    blockType = "callout" as BlockType;

    async addSection(sections: Readonly<CalloutInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        let settings = readMathCalloutSettings(
            await this.noteIndexer.getLine(sectionCache.position.start.line)
        );
        if (settings) {
            sections.push(
                { cache: sectionCache, settings: settings }
            );
        }
    }

    async setMathLinks(callouts: readonly Readonly<CalloutInfo>[]): Promise<void> {
        let index = 0;
        for (let callout of callouts) {
            let autoNumber = callout.settings.number == 'auto';
            if (autoNumber) {
                callout.settings._index = index++;
            }
            let resolvedSettings = resolveSettings(
                callout.settings,
                this.noteIndexer.plugin,
                this.noteIndexer.file
            );
            let newTitle = formatTitle(resolvedSettings);
            let oldSettingsAndTitle = readMathCalloutSettingsAndTitle(
                await this.noteIndexer.getLine(callout.cache.position.start.line)
            );
            if (oldSettingsAndTitle) {
                let { settings, title } = oldSettingsAndTitle;
                let lineNumber = callout.cache.position.start.line;
                let newSettings = this.removeDeprecated(callout.settings);
                if (this.noteIndexer.isSafe(lineNumber) && JSON.stringify(settings) != JSON.stringify(newSettings) || title != newTitle) {
                    await this.overwriteSettings(
                        lineNumber, newSettings, newTitle
                    )
                }
                let id = callout.cache.id;
                if (id) {
                    this.mathLinkBlocks[id] = newTitle;
                }
            }
        }
    }

    async overwriteSettings(lineNumber: number, settings: MathSettings, title?: string) {
        const matchResult = matchMathCallout(await this.noteIndexer.getLine(lineNumber));
        if (!matchResult) {
            throw Error(`Math callout not found at line ${lineNumber}, could not overwrite`);
        }
        this.noteIndexer.setLine(
            lineNumber,
            `> [!math|${JSON.stringify(settings)}] ${title ?? ""}`,
        );
    }

    private removeDeprecated(settings: MathSettings & { autoIndex?: string }): MathSettings {
        // remove the deprecated "autoIndex" key (now it's called "_index") from settings
        let { autoIndex, ...rest } = settings;
        return rest;
    }
}

class EquationIndexer extends BlockIndexer<EquationInfo> {
    blockType = "math" as BlockType;

    async addSection(sections: Readonly<EquationInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        if (sectionCache.id && this.noteIndexer.linkedBlockIds.contains(sectionCache.id)) {
            let text = await this.noteIndexer.getRange(sectionCache.position);
            let tagMatch = text.match(/\\tag\{(.*)\}/);
            if (tagMatch) {
                sections.push({ cache: sectionCache, manualTag: tagMatch[1] });
            } else {
                sections.push({ cache: sectionCache });
            }
        }
    }

    async setMathLinks(equations: readonly Readonly<EquationInfo>[]): Promise<void> {
        let contextSettings = findNearestAncestorContextSettings(this.noteIndexer.plugin, this.noteIndexer.file);
        let style = contextSettings?.eq_number_style ?? DEFAULT_SETTINGS.eq_number_style as NumberStyle;
        let equationNumber = 1;
        for (let i = 0; i < equations.length; i++) {
            let equation = equations[i];
            let id = equation.cache.id;
            if (id) {
                if (equation.manualTag) {
                    this.mathLinkBlocks[id] = `(${equation.manualTag})`;
                } else {
                    this.mathLinkBlocks[id] = "(" + CONVERTER[style](equationNumber) + ")";
                    equationNumber++;
                }
            }
        }
    }
}

abstract class SingleNoteIndexer {
    linkedBlockIds: string[];
    calloutIndexer: MathCalloutIndexer;
    equationIndexer: EquationIndexer;
    mathLinkBlocks: MathLinkBlocks;

    constructor(public app: App, public plugin: MathPlugin, public file: TFile) {
        this.linkedBlockIds = getBlockIdsWithBacklink(this.file.path, this.plugin);
        this.calloutIndexer = new MathCalloutIndexer(this);
        this.equationIndexer = new EquationIndexer(this);
    }

    abstract setLine(lineNumber: number, text: string): Promise<void>;
    abstract getLine(lineNumber: number): Promise<string>;
    abstract getRange(position: Pos): Promise<string>;
    abstract isSafe(lineNumber: number): boolean;

    async run(cache?: CachedMetadata) {
        cache = cache ?? this.app.metadataCache.getFileCache(this.file) ?? undefined;
        if (!cache) return;

        await this.calloutIndexer.run(cache);
        await this.equationIndexer.run(cache);
        this.mathLinkBlocks = Object.assign(
            {},
            this.calloutIndexer.mathLinkBlocks,
            this.equationIndexer.mathLinkBlocks,
        );
        this.plugin.getMathLinksAPI()?.update(
            this.file.path,
            { "mathLink-blocks": this.mathLinkBlocks }
        );
        this.app.metadataCache.trigger(
            "math-booster:index-updated", 
            this
        );
    }

    async getBlockText(blockID: string, cache?: CachedMetadata): Promise<string | undefined> {
        cache = cache ?? this.app.metadataCache.getFileCache(this.file) ?? undefined;
        if (cache) {
            let sectionCache = cache.sections?.find(
                (sectionCache) => sectionCache.id == blockID
            );
            let position = sectionCache?.position;
            if (position) {
                return await this.getRange(position);
            }
        }
    }
}

export class ActiveNoteIndexer extends SingleNoteIndexer {
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


export class NonActiveNoteIndexer extends SingleNoteIndexer {

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

export class AutoNoteIndexer {
    constructor(public app: App, public plugin: MathPlugin, public file: TFile) { }

    getIndexer(activeMarkdownView?: MarkdownView | null): ActiveNoteIndexer | NonActiveNoteIndexer {
        activeMarkdownView = activeMarkdownView ?? this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeMarkdownView?.file == this.file) {
            return new ActiveNoteIndexer(this.app, this.plugin, activeMarkdownView);
        } else {
            return new NonActiveNoteIndexer(this.app, this.plugin, this.file);
        }
    }

    async run(activeMarkdownView?: MarkdownView | null) {
        await this.getIndexer(activeMarkdownView).run();
    }
}

export class LinkedNotesIndexer {
    constructor(public app: App, public plugin: MathPlugin, public changedFile: TFile) { }

    async run() {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        await Promise.all([
            (new AutoNoteIndexer(this.app, this.plugin, this.changedFile)).run(),
            this.runForwardLinks(view),
            this.runBackLinks(view), // not sure if this is really necessary
        ]);
    }

    async runForwardLinks(activeMarkdownView: MarkdownView | null) {
        await this.runImpl("map", activeMarkdownView);
    }

    async runBackLinks(activeMarkdownView: MarkdownView | null) {
        await this.runImpl("invMap", activeMarkdownView);
    }
    
    private async runImpl(key: "map" | "invMap", activeMarkdownView: MarkdownView | null) {
        let links = this.plugin.oldLinkMap?.[key].get(this.changedFile.path);
        if (links) {
            await Promise.all(
                Array.from(links).map((link) => {
                    if (activeMarkdownView?.file.path == link) {
                        return (new ActiveNoteIndexer(this.app, this.plugin, activeMarkdownView)).run();
                    } else {
                        let file = this.app.vault.getAbstractFileByPath(link);
                        if (file instanceof TFile) {
                            return (new NonActiveNoteIndexer(this.app, this.plugin, file)).run();
                        }
                    }
                })
            );
        }
    }
}

export class VaultIndexer {
    constructor(public app: App, public plugin: MathPlugin) { }

    async run() {
        let files = this.app.vault.getMarkdownFiles();
        let promises: Promise<void>[] = []
        this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
            if (leaf.view instanceof MarkdownView) {
                removeFrom(leaf.view.file, files);
                promises.push(
                    (new ActiveNoteIndexer(this.app, this.plugin, leaf.view)).run()
                );
            }
        });

        for (let file of files) {
            promises.push(
                (new NonActiveNoteIndexer(this.app, this.plugin, file)).run()
            );
        }

        await Promise.all(promises);
    }
}
