import { App, Editor, Pos, TFile } from "obsidian";

import { locToEditorPosition, splitIntoLines } from "./utils";


export abstract class FileIO {
    abstract setLine(lineNumber: number, text: string): Promise<void>;
    abstract getLine(lineNumber: number): Promise<string>;
    abstract getRange(position: Pos): Promise<string>;
    abstract isSafe(lineNumber: number): boolean;
}


export class ActiveNoteIO extends FileIO {
    constructor(public editor: Editor) {
        super();
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


export class NonActiveNoteIO extends FileIO {
    constructor(public app: App, public file: TFile) {
        super();
    }

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
