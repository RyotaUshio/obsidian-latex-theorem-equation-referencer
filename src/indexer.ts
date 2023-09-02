import { App, CachedMetadata, MarkdownView, SectionCache, TFile } from 'obsidian';

import MathBooster from './main';
import { DEFAULT_SETTINGS, MathSettings, NumberStyle, MathCalloutRefFormat, ResolvedMathSettings, MathCalloutSettings, MathCalloutPrivateFields } from './settings/settings';
import { getBlockIdsWithBacklink, readMathCalloutSettings, resolveSettings, formatTitle, readMathCalloutSettingsAndTitle, CONVERTER, matchMathCallout, formatTitleWithoutSubtitle, isEditingView } from './utils';
import { ActiveNoteIO, FileIO, NonActiveNoteIO } from './file_io';


/** Index content */

export type IndexItemType = "theorem" | "equation";
export type IndexItem = { type: IndexItemType, printName: string, refName: string, cache: SectionCache, file: TFile, settings?: MathCalloutSettings, mathText?: string };

export class NoteIndex {
    theorem: Set<IndexItem>;
    equation: Set<IndexItem>;
    idItemMap: Record<string, IndexItem>;

    constructor(public file: TFile) {
        this.theorem = new Set<IndexItem>();
        this.equation = new Set<IndexItem>();
        this.idItemMap = {};
    }

    add(newItem: IndexItem): NoteIndex {
        this[newItem.type].add(newItem);
        if (newItem.cache.id) {
            this.idItemMap[newItem.cache.id] = newItem;
        }
        return this;
    }

    clear(which: IndexItemType): NoteIndex {
        this[which].clear();
        for (const id in this.idItemMap) {
            if (this.idItemMap[id].type == which) {
                delete this.idItemMap[id];
            }
        }
        return this;
    }

    size(which: IndexItemType): number {
        return this[which].size;
    }

    getItemById(id: string): IndexItem | undefined {
        return this.idItemMap[id];
    }

    getItemByPos(pos: number, which?: IndexItemType): IndexItem | undefined {
        if (which) {
            return Array.from(this[which]).find((item) => item.cache.position.start.offset == pos || item.cache.position.end.offset == pos);
        }
        return this.getItemByPos(pos, "theorem") ?? this.getItemByPos(pos, "equation");
    }
}


export class VaultIndex {
    data: Map<TFile, NoteIndex>;

    constructor(public app: App, public plugin: MathBooster) {
        this.data = new Map<TFile, NoteIndex>();
    }

    getNoteIndex(file: TFile): NoteIndex {
        const note = this.data.get(file);
        if (note) {
            return note;
        }
        const newNote = new NoteIndex(file);
        this.data.set(file, newNote);
        return newNote;
    }
}


type MathLinkBlocks = Record<string, string>;

type BlockType = "callout" | "math";
type CalloutInfo = { cache: SectionCache, settings: MathCalloutSettings & MathCalloutPrivateFields };
type EquationInfo = { cache: SectionCache, manualTag?: string };


/**
 * Indexers for theorem callouts and equations in a note
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
        const note = this.noteIndexer.plugin.index.getNoteIndex(this.noteIndexer.file).clear("theorem");

        let index = 0;

        for (let i = 0; i < callouts.length; i++) {
            const callout = callouts[i];

            if (note.size("theorem") > i) {
                // avoid duplicate registeration. this method can be called multiple times almost simultaneously
                continue;
            }

            const resolvedSettings = this.resolveSettings(callout);
            const autoNumber = callout.settings.number == 'auto';
            if (autoNumber) {
                callout.settings._index = index++;
            }

            const newTitle = formatTitle(this.noteIndexer.plugin, resolvedSettings);
            const oldSettingsAndTitle = readMathCalloutSettingsAndTitle(
                await this.noteIndexer.io.getLine(callout.cache.position.start.line)
            );

            let refName = "";
            if (oldSettingsAndTitle) {
                const { settings, title } = oldSettingsAndTitle;
                const lineNumber = callout.cache.position.start.line;
                const newSettings = callout.settings;
                if (this.noteIndexer.io.isSafe(lineNumber) && JSON.stringify(settings) != JSON.stringify(newSettings) || title != newTitle) {
                    await this.overwriteSettings(lineNumber, newSettings, newTitle)
                }

                const id = callout.cache.id;
                refName = this.formatMathLink(resolvedSettings, "refFormat");
                if (id) {
                    this.mathLinkBlocks[id] = refName;
                }
            }

            if (note.size("theorem") == i) {
                // avoid duplicate registeration. this method can be called multiple times almost simultaneously
                note.add({ type: "theorem", printName: newTitle, refName, cache: callout.cache, file: this.noteIndexer.file, settings: callout.settings });
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
        if (refFormat == "[type] [number] ([title])") {
            return formatTitle(this.noteIndexer.plugin, resolvedSettings, true);
        }
        if (refFormat == "[type] [number]") {
            return formatTitleWithoutSubtitle(this.noteIndexer.plugin, resolvedSettings);
        }
        if (refFormat == "[title] if title exists, [type] [number] otherwise") {
            return resolvedSettings.title ? resolvedSettings.title : formatTitleWithoutSubtitle(this.noteIndexer.plugin, resolvedSettings);
        }
        // if (refFormat == "[title] ([type] [number]) if title exists, [type] [number] otherwise") 
        const typePlusNumber = formatTitleWithoutSubtitle(this.noteIndexer.plugin, resolvedSettings);
        return resolvedSettings.title ? `${resolvedSettings.title} (${typePlusNumber})` : typePlusNumber;
    }

    async overwriteSettings(lineNumber: number, settings: MathCalloutSettings & MathCalloutPrivateFields, title?: string) {
        const matchResult = matchMathCallout(await this.noteIndexer.io.getLine(lineNumber));
        if (!matchResult) {
            throw Error(`Theorem callout not found at line ${lineNumber}, could not overwrite`);
        }
        this.noteIndexer.io.setLine(
            lineNumber,
            `> [!math|${JSON.stringify(settings)}] ${title ?? ""}`,
        );
    }

    removeDeprecated(settings: MathSettings & { autoIndex?: string }): MathCalloutSettings & MathCalloutPrivateFields {
        // remove the deprecated "autoIndex" key (now it's called "_index") from settings
        const { autoIndex, ...rest } = settings;
        return rest;
    }
}


class EquationIndexer<IOType extends FileIO> extends BlockIndexer<IOType, EquationInfo> {
    blockType = "math" as BlockType;

    async addSection(sections: Readonly<EquationInfo>[], sectionCache: Readonly<SectionCache>): Promise<void> {
        const text = await this.noteIndexer.io.getRange(sectionCache.position);
        const tagMatch = text.match(/\\tag\{(.*)\}/);
        if (tagMatch) {
            sections.push({ cache: sectionCache, manualTag: tagMatch[1] });
        } else {
            sections.push({ cache: sectionCache });
        }
    }

    async setMathLinks(equations: readonly Readonly<EquationInfo>[]): Promise<void> {
        const note = this.noteIndexer.plugin.index.getNoteIndex(this.noteIndexer.file).clear("equation");

        const contextSettings = resolveSettings(undefined, this.noteIndexer.plugin, this.noteIndexer.file);
        const style = contextSettings?.eqNumberStyle ?? DEFAULT_SETTINGS.eqNumberStyle as NumberStyle;
        let equationNumber = +(contextSettings?.eqNumberInit ?? DEFAULT_SETTINGS.eqNumberInit);
        const prefix = contextSettings?.eqNumberPrefix ?? DEFAULT_SETTINGS.eqNumberPrefix;
        const suffix = contextSettings?.eqNumberSuffix ?? DEFAULT_SETTINGS.eqNumberSuffix;
        for (let i = 0; i < equations.length; i++) {
            if (note.size("equation") > i) {
                continue;
            }
            const equation = equations[i];
            const id = equation.cache.id;
            let printName = "";
            let refName = "";
            if (id && this.noteIndexer.linkedBlockIds.contains(id)) { // number only referenced equations
                const { eqRefPrefix, eqRefSuffix } = contextSettings;
                if (equation.manualTag) {
                    printName = `(${equation.manualTag})`;
                } else {
                    printName = "(" + prefix + CONVERTER[style](equationNumber) + suffix + ")";
                    equationNumber++;
                }
                refName = eqRefPrefix + printName + eqRefSuffix;
                this.mathLinkBlocks[id] = refName;
            }

            const mathText = (await this.noteIndexer.io.getRange(equation.cache.position)).match(/\$\$([\s\S]*)\$\$/)?.[1].trim();

            if (note.size("equation") == i) {
                note.add({ type: "equation", printName, refName, cache: equation.cache, file: this.noteIndexer.file, mathText });
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

        await Promise.all([
            this.calloutIndexer.run(cache),
            this.equationIndexer.run(cache),
        ]);
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
}


export class ActiveNoteIndexer extends NoteIndexer<ActiveNoteIO> {
    /**
     * Indexer for the currently active note.
     * @param app 
     * @param plugin 
     * @param view 
     */
    constructor(public app: App, public plugin: MathBooster, view: MarkdownView) {
        super(app, plugin, view.file, new ActiveNoteIO(plugin, view.file, view.editor));
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
        super(app, plugin, file, new NonActiveNoteIO(plugin, file));
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
        if (activeMarkdownView?.file == this.file && isEditingView(activeMarkdownView)) {
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
