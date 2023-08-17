import { App, CachedMetadata, MarkdownView, SectionCache, TFile } from 'obsidian';

import MathBooster from './main';
import { DEFAULT_SETTINGS, MathSettings, NumberStyle, MathCalloutRefFormat, ResolvedMathSettings } from './settings/settings';
import { getBlockIdsWithBacklink, readMathCalloutSettings, resolveSettings, formatTitle, readMathCalloutSettingsAndTitle, CONVERTER, matchMathCallout, formatTitleWithoutSubtitle } from './utils';
import { ActiveNoteIO, FileIO, NonActiveNoteIO } from './file_io';


type MathLinkBlocks = Record<string, string>;

type BlockType = "callout" | "math";
type CalloutInfo = { cache: SectionCache, settings: MathSettings };
type EquationInfo = { cache: SectionCache, manualTag?: string };


/**
 * Indexers for math callouts and equations in a note
 */

abstract class BlockIndexer<IOType extends FileIO, BlockInfo extends { cache: SectionCache }> {
    mathLinkBlocks: MathLinkBlocks;

    constructor(public noteIndexer: NoteIndexer<IOType>) {
        this.mathLinkBlocks = {};
    }

    abstract readonly blockType: BlockType;

    abstract addSection(sections: Readonly<BlockInfo>[], sectionCache: Readonly<SectionCache>): Promise<void>;
    abstract setMathLinks(blocks: readonly Readonly<BlockInfo>[]): Promise<void>;

    async getBlocks(cache: Readonly<CachedMetadata>): Promise<BlockInfo[]> {
        const sectionCaches = cache.sections?.filter(
            (sectionCache) => sectionCache.type == this.blockType
        );
        const sections: BlockInfo[] = [];
        if (sectionCaches) {
            for (const sectionCache of sectionCaches) {
                await this.addSection(sections, sectionCache);
            }
        }
        return sections;
    }

    async sorted(cache: Readonly<CachedMetadata>): Promise<BlockInfo[]> {
        const blocks = await this.getBlocks(cache)
        return blocks.sort(
            (section1, section2) => {
                return section1.cache.position.start.line - section2.cache.position.start.line;
            }
        );
    }

    async iter(cache: Readonly<CachedMetadata>, callback: (section: BlockInfo) => any): Promise<void> {
        const blocks = await this.getBlocks(cache);
        blocks.forEach(callback);
    }

    async run(cache: Readonly<CachedMetadata>): Promise<void> {
        const blocks = await this.sorted(cache);
        await this.setMathLinks(blocks);
    }
}


class MathCalloutIndexer<IOType extends FileIO> extends BlockIndexer<IOType, CalloutInfo> {
    blockType = "callout" as BlockType;

    async addSection(sections: Readonly<CalloutInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        const line = await this.noteIndexer.io.getLine(sectionCache.position.start.line);
        const settings = readMathCalloutSettings(line);
        if (settings) {
            sections.push(
                { cache: sectionCache, settings: this.removeDeprecated(settings) }
            );
        }
    }

    resolveSettings(callout: Readonly<CalloutInfo>): ResolvedMathSettings {
        return resolveSettings(callout.settings, this.noteIndexer.plugin, this.noteIndexer.file);    
    }

    async setMathLinks(callouts: readonly Readonly<CalloutInfo>[]): Promise<void> {
        let index = 0;
        for (const callout of callouts) {
            const resolvedSettings = this.resolveSettings(callout);
            
            const autoNumber = callout.settings.number == 'auto';
            if (autoNumber) {
                callout.settings._index = index++;
            }
            
            const newTitle = formatTitle(resolvedSettings);
            const oldSettingsAndTitle = readMathCalloutSettingsAndTitle(
                await this.noteIndexer.io.getLine(callout.cache.position.start.line)
            );
            if (oldSettingsAndTitle) {
                const { settings, title } = oldSettingsAndTitle;
                const lineNumber = callout.cache.position.start.line;
                const newSettings = callout.settings;
                if (this.noteIndexer.io.isSafe(lineNumber) && JSON.stringify(settings) != JSON.stringify(newSettings) || title != newTitle) {
                    await this.overwriteSettings(lineNumber, newSettings, newTitle)
                }
                const id = callout.cache.id;
                if (id) {
                    this.mathLinkBlocks[id] = this.formatMathLink(resolvedSettings, "refFormat");
                }
            }
        }
        this.setNoteMathLink(callouts);
    }

    setNoteMathLink(callouts: readonly CalloutInfo[]) {
        const index = callouts.findIndex((callout) => callout.settings.setAsNoteMathLink);
        if (index >= 0) {
            const resolvedSettings = this.resolveSettings(callouts[index]);

            this.noteIndexer.plugin.getMathLinksAPI()?.update(
                this.noteIndexer.file.path, {
                    "mathLink": this.formatMathLink(resolvedSettings, "noteMathLinkFormat")
                }
            )
        } else {
            this.noteIndexer.plugin.getMathLinksAPI()?.update(
                this.noteIndexer.file.path, {
                    "mathLink": undefined
                }
            )
        }
    }

    formatMathLink(resolvedSettings: ResolvedMathSettings, key: "refFormat" | "noteMathLinkFormat"): string {
        const refFormat: MathCalloutRefFormat = resolvedSettings[key];
        if (refFormat == "Type + number (+ title)") {
            return formatTitle(resolvedSettings, true);
        }
        if (refFormat == "Type + number") {
            return formatTitleWithoutSubtitle(resolvedSettings);
        }
        // if (refFormat == "Only title if exists, type + number otherwise"))
        return resolvedSettings.title ? resolvedSettings.title : formatTitleWithoutSubtitle(resolvedSettings);
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

    removeDeprecated(settings: MathSettings & { autoIndex?: string }): MathSettings {
        // remove the deprecated "autoIndex" key (now it's called "_index") from settings
        const { autoIndex, ...rest } = settings;
        return rest;
    }
}


class EquationIndexer<IOType extends FileIO> extends BlockIndexer<IOType, EquationInfo> {
    blockType = "math" as BlockType;

    async addSection(sections: Readonly<EquationInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        if (sectionCache.id && this.noteIndexer.linkedBlockIds.contains(sectionCache.id)) {
            const text = await this.noteIndexer.io.getRange(sectionCache.position);
            const tagMatch = text.match(/\\tag\{(.*)\}/);
            if (tagMatch) {
                sections.push({ cache: sectionCache, manualTag: tagMatch[1] });
            } else {
                sections.push({ cache: sectionCache });
            }
        }
    }

    async setMathLinks(equations: readonly Readonly<EquationInfo>[]): Promise<void> {
        const contextSettings = resolveSettings(undefined, this.noteIndexer.plugin, this.noteIndexer.file);
        const style = contextSettings?.eqNumberStyle ?? DEFAULT_SETTINGS.eqNumberStyle as NumberStyle;
        let equationNumber = +(contextSettings?.eqNumberInit ?? DEFAULT_SETTINGS.eqNumberInit);
        const prefix = contextSettings?.eqNumberPrefix ?? DEFAULT_SETTINGS.eqNumberPrefix;
        const suffix = contextSettings?.eqNumberSuffix ?? DEFAULT_SETTINGS.eqNumberSuffix;
        for (let i = 0; i < equations.length; i++) {
            const equation = equations[i];
            const id = equation.cache.id;
            if (id) {
                const { eqRefPrefix, eqRefSuffix } = contextSettings;
                if (equation.manualTag) {
                    this.mathLinkBlocks[id] = eqRefPrefix + `(${equation.manualTag})` + eqRefSuffix;
                } else {
                    this.mathLinkBlocks[id] = eqRefPrefix + "(" + prefix + CONVERTER[style](equationNumber) + suffix + ")" + eqRefSuffix;
                    equationNumber++;
                }
            }
        }
    }
}


/**
 * Indexers for an entire note
 */

abstract class NoteIndexer<IOType extends FileIO> {
    linkedBlockIds: string[];
    calloutIndexer: MathCalloutIndexer<IOType>;
    equationIndexer: EquationIndexer<IOType>;
    mathLinkBlocks: MathLinkBlocks;

    constructor(public app: App, public plugin: MathBooster, public file: TFile, public io: IOType) {
        if (file.extension != "md") {
            throw Error(`${plugin.manifest.name}: Non-markdown file was passed: "${file.path}"`);
        }
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
            const sectionCache = cache.sections?.find(
                (sectionCache) => sectionCache.id == blockID
            );
            const position = sectionCache?.position;
            if (position) {
                return await this.io.getRange(position);
            }
        }
    }
}


export class ActiveNoteIndexer extends NoteIndexer<ActiveNoteIO> {
    /**
     * Indexer for the currently active note.
     * @param app 
     * @param plugin 
     * @param view 
     */
    constructor(public app: App, public plugin: MathBooster, view: MarkdownView) {
        super(app, plugin, view.file, new ActiveNoteIO(view.editor));
    }
}


export class NonActiveNoteIndexer extends NoteIndexer<NonActiveNoteIO> {
    /**
     * Indexer for non-active (= currently not opened / currently opened but not focused) notes.
     * @param app 
     * @param plugin 
     * @param file 
     */
    constructor(app: App, plugin: MathBooster, file: TFile) {
        super(app, plugin, file, new NonActiveNoteIO(app, file));
    }
}


/**
 * Utility indexers
 */

export class AutoNoteIndexer {
    /**
     * Convenient class that automatically judges which of ActiveNoteIndexer or NonActiveNoteIndexer 
     * should be called for the given file.
     * @param app 
     * @param plugin 
     * @param file 
     */
    constructor(public app: App, public plugin: MathBooster, public file: TFile) { }

    /**
     * Get an appropriate indexer for the active markdown view.
     * @param activeMarkdownView 
     * @returns 
     */
    getIndexer(activeMarkdownView?: MarkdownView | null): ActiveNoteIndexer | NonActiveNoteIndexer {
        activeMarkdownView = activeMarkdownView ?? this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeMarkdownView?.file == this.file && activeMarkdownView.getMode() == "source") {
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
    /**
     * Re-index the changed note and all the notes that have forward/backlinks to the changed note.
     * @param app 
     * @param plugin 
     * @param changedFile 
     */
    constructor(public app: App, public plugin: MathBooster, public changedFile: TFile) { }

    async run() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
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
        const links = this.plugin.oldLinkMap?.[key].get(this.changedFile.path);
        if (links) {
            await Promise.all(
                Array.from(links).map((link) => {
                    if (activeMarkdownView?.file.path == link) {
                        return (new ActiveNoteIndexer(this.app, this.plugin, activeMarkdownView)).run();
                    } else {
                        const file = this.app.vault.getAbstractFileByPath(link);
                        if (file instanceof TFile && file.extension == "md") {
                            return (new NonActiveNoteIndexer(this.app, this.plugin, file)).run();
                        }
                    }
                })
            );
        }
    }
}


export class VaultIndexer {
    /**
     * Index the entire vault.
     * @param app 
     * @param plugin 
     */
    constructor(public app: App, public plugin: MathBooster) { }

    async run() {
        const notes = this.app.vault.getMarkdownFiles();
        const activeMarkdownview = this.app.workspace.getActiveViewOfType(MarkdownView);
        const promises = notes.map((note) =>
            (new AutoNoteIndexer(this.app, this.plugin, note)).run(activeMarkdownview)
        );
        await Promise.all(promises);
    }
}
