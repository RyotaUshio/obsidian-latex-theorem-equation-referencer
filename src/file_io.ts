import { App, CachedMetadata, Editor, MarkdownView, Pos, TFile } from "obsidian";

import MathBooster from "./main";
import { insertAt, isEditingView, locToEditorPosition, splitIntoLines } from "./utils";


export abstract class FileIO {
    constructor(public plugin: MathBooster, public file: TFile) { }
    abstract setLine(lineNumber: number, text: string): Promise<void>;
    abstract setRange(position: Pos, text: string): Promise<void>;
    abstract insertLine(lineNumber: number, text: string): Promise<void>;
    abstract getLine(lineNumber: number): Promise<string>;
    abstract getRange(position: Pos): Promise<string>;
    /**
     * Check if the line at `lineNumber` can be safely overwritten.
     * It was necessary for sure before, but I'm not sure if it is now, 
     * because now the JSON metadata of theorem callouts are hidden by a view plugin.
     * I'll check it later.
     * @param lineNumber 
     */
    abstract isSafe(lineNumber: number): boolean;

    async getBlockTextFromID(blockID: string, cache?: CachedMetadata): Promise<string | undefined> {
        cache = cache ?? this.plugin.app.metadataCache.getFileCache(this.file) ?? undefined;
        if (cache) {
            const sectionCache = cache.sections?.find(
                (sectionCache) => sectionCache.id == blockID
            );
            const position = sectionCache?.position;
            if (position) {
                return await this.getRange(position);
            }
        }
    }
}


export class ActiveNoteIO extends FileIO {
    /**
     * File IO for the currently active markdown view. 
     * Uses the Editor interface instead of Vault.
     * (See https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Prefer+the+Editor+API+instead+of+%60Vault.modify%60)
     * @param editor 
     */
    constructor(plugin: MathBooster, file: TFile, public editor: Editor) {
        super(plugin, file);
    }

    async setLine(lineNumber: number, text: string): Promise<void> {
        this.editor.setLine(lineNumber, text);
    }

    async setRange(position: Pos, text: string): Promise<void> {
        const from = locToEditorPosition(position.start);
        const to = locToEditorPosition(position.end);
        this.editor.replaceRange(text, from, to);
    }

    async insertLine(lineNumber: number, text: string): Promise<void> {
        this.editor.replaceRange(text + "\n", { line: lineNumber, ch: 0 });
    }

    async getLine(lineNumber: number): Promise<string> {
        return this.editor.getLine(lineNumber);
    }

    async getRange(position: Pos): Promise<string> {
        const from = locToEditorPosition(position.start);
        const to = locToEditorPosition(position.end);
        const text = this.editor.getRange(from, to);
        return text;
    }

    isSafe(lineNumber: number): boolean {
        const cursorPos = this.editor.getCursor();
        return cursorPos.line != lineNumber;
    }
}


export class NonActiveNoteIO extends FileIO {
    /**
     * File IO for non-active (= currently not opened / currently opened but not focused) notes.
     * Uses the Vault interface instead of Editor.
     */

    async setLine(lineNumber: number, text: string): Promise<void> {
        this.plugin.app.vault.process(this.file, (data: string): string => {
            const lines = splitIntoLines(data);
            lines[lineNumber] = text;
            return lines.join('\n');
        })
    }

    async setRange(position: Pos, text: string): Promise<void> {
        this.plugin.app.vault.process(this.file, (data: string): string => {
            return data.slice(0, position.start.offset) + text + data.slice(position.end.offset + 1, data.length);
        })
    }

    async insertLine(lineNumber: number, text: string): Promise<void> {
        this.plugin.app.vault.process(this.file, (data: string): string => {
            const lines = splitIntoLines(data);
            insertAt(lines, text, lineNumber);
            return lines.join('\n');
        })
    }

    async getLine(lineNumber: number): Promise<string> {
        const data = await this.plugin.app.vault.cachedRead(this.file);
        const lines = splitIntoLines(data);
        return lines[lineNumber];
    }

    async getRange(position: Pos): Promise<string> {
        const content = await this.plugin.app.vault.cachedRead(this.file);
        return content.slice(position.start.offset, position.end.offset);
    }

    isSafe(lineNumber: number): boolean {
        return true;
    }
}


/**
 * Automatically judges which of ActiveNoteIO or NonActiveNoteIO
 * should be used for the given file.
 */
export function getIO(plugin: MathBooster, file: TFile, activeMarkdownView?: MarkdownView | null) {
    activeMarkdownView = activeMarkdownView ?? plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeMarkdownView && activeMarkdownView.file == file && isEditingView(activeMarkdownView)) {
        return new ActiveNoteIO(plugin, file, activeMarkdownView.editor);
    } else {
        return new NonActiveNoteIO(plugin, file);
    }
}
