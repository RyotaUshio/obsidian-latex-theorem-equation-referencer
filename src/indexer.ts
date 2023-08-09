import { App, CachedMetadata, MarkdownView, SectionCache, TFile, WorkspaceLeaf } from 'obsidian';

import MathBooster from './main';
import { DEFAULT_SETTINGS, MathSettings, NumberStyle } from './settings/settings';
import { getBlockIdsWithBacklink, readMathCalloutSettings, findNearestAncestorContextSettings, resolveSettings, formatTitle, readMathCalloutSettingsAndTitle, CONVERTER, matchMathCallout, splitIntoLines, removeFrom } from './utils';
import { ActiveNoteIO, FileIO, NonActiveNoteIO } from './file_io';

type MathLinkBlocks = Record<string, string>;

type BlockType = "callout" | "math";
type CalloutInfo = { cache: SectionCache, settings: MathSettings };
type EquationInfo = { cache: SectionCache, manualTag?: string };


abstract class BlockIndexer<IOType extends FileIO, BlockInfo extends { cache: SectionCache }> {
    mathLinkBlocks: MathLinkBlocks;

    constructor(public noteIndexer: NoteIndexer<IOType>) {
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

class MathCalloutIndexer<IOType extends FileIO> extends BlockIndexer<IOType, CalloutInfo> {
    blockType = "callout" as BlockType;

    async addSection(sections: Readonly<CalloutInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        let settings = readMathCalloutSettings(
            await this.noteIndexer.io.getLine(sectionCache.position.start.line)
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
                await this.noteIndexer.io.getLine(callout.cache.position.start.line)
            );
            if (oldSettingsAndTitle) {
                let { settings, title } = oldSettingsAndTitle;
                let lineNumber = callout.cache.position.start.line;
                let newSettings = this.removeDeprecated(callout.settings);
                if (this.noteIndexer.io.isSafe(lineNumber) && JSON.stringify(settings) != JSON.stringify(newSettings) || title != newTitle) {
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
        const matchResult = matchMathCallout(await this.noteIndexer.io.getLine(lineNumber));
        if (!matchResult) {
            throw Error(`Math callout not found at line ${lineNumber}, could not overwrite`);
        }
        this.noteIndexer.io.setLine(
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

class EquationIndexer<IOType extends FileIO> extends BlockIndexer<IOType, EquationInfo> {
    blockType = "math" as BlockType;

    async addSection(sections: Readonly<EquationInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        if (sectionCache.id && this.noteIndexer.linkedBlockIds.contains(sectionCache.id)) {
            let text = await this.noteIndexer.io.getRange(sectionCache.position);
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

class NoteIndexer<IOType extends FileIO> {
    linkedBlockIds: string[];
    calloutIndexer: MathCalloutIndexer<IOType>;
    equationIndexer: EquationIndexer<IOType>;
    mathLinkBlocks: MathLinkBlocks;

    constructor(public app: App, public plugin: MathBooster, public file: TFile, public io: IOType) {
        this.linkedBlockIds = getBlockIdsWithBacklink(this.file.path, this.plugin);
        this.calloutIndexer = new MathCalloutIndexer(this);
        this.equationIndexer = new EquationIndexer(this);
    }

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
                return await this.io.getRange(position);
            }
        }
    }
}


export class ActiveNoteIndexer extends NoteIndexer<ActiveNoteIO> {
    constructor(public app: App, public plugin: MathBooster, view: MarkdownView) {
        super(app, plugin, view.file, new ActiveNoteIO(view.editor));
    }
}


export class NonActiveNoteIndexer extends NoteIndexer<NonActiveNoteIO> {
    constructor(app: App, plugin: MathBooster, file: TFile) {
        super(app, plugin, file, new NonActiveNoteIO(app, file));
    }
}


export class AutoNoteIndexer {
    constructor(public app: App, public plugin: MathBooster, public file: TFile) { }

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
    constructor(public app: App, public plugin: MathBooster, public changedFile: TFile) { }

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
    constructor(public app: App, public plugin: MathBooster) { }

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
