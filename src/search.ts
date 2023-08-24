import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile, prepareFuzzySearch, sortSearchResults, SearchResult, Scope, MarkdownRenderer, Modal, SectionCache } from "obsidian";

import MathBooster from "./main";
import { ActiveNoteIO, NonActiveNoteIO, getIO } from './file_io';
import { resolveSettings } from './utils';


export type MathItem = { path: string, id?: string, name: string };


export class TheoremSuggest extends EditorSuggest<MathItem> {
    scope: Scope;

    constructor(public app: App, public plugin: MathBooster) {
        super(app);
        this.scope.register(["Meta"], "Enter", () => {
            // Reference: https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/blob/be4a12c3f861c31f2be3c0f81809cfc5ab6bb5fd/src/ui/AutoCompleteSuggest.ts#L595-L619
            const item = this.suggestions.values[this.suggestions.selectedItem];
            const modal = new SearchPreviewModal(this.app, this.plugin, item);
            modal.open();
            console.log("press");
            return false;
        })
    }

    renderSuggestion(value: MathItem, el: HTMLElement): void {
        // el.setAttribute("style", "display: inline-block;");
        const base = el.createDiv({cls: "math-booster-search-item"});
        base.createDiv({text: value.name});
        base.createEl("small", {text: `${value.path}`, cls: "math-booster-search-item-description"});
    }

    selectSuggestion(value: MathItem, evt: MouseEvent | KeyboardEvent): void {
        if (this.context) {
            const { editor, start, end, file } = this.context;
            const settings = resolveSettings(undefined, this.plugin, file);
            editor.replaceRange(
                `[[${value.path == file.path ? "" : value.path}#^${value.id}]]${settings.insertSpace ? " " : ""}`, 
                start, 
                end
            );
        }
    }

    getSuggestions(context: EditorSuggestContext): MathItem[] {
        const data = this.plugin.getMathLinksAPI()?.metadataSet;
        if (!data) return [];

        const callback = prepareFuzzySearch(context.query);
        const results: { match: SearchResult, item: MathItem }[] = [];

        for (const path in data) {
            if (data[path]["mathLink-blocks"]) {
                for (const id in data[path]["mathLink-blocks"]) {
                    const name = data[path]["mathLink-blocks"]?.[id];
                    if (name) {
                        const result = callback(name);
                        if (result) {
                            results.push({ match: result, item: { path, id, name } });
                        }
                    }
                }
            }
        }

        sortSearchResults(results);
        return results.map((result) => result.item);
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        const trigger = this.plugin.extraSettings.searchTrigger;

        const text = editor.getRange({ line: cursor.line, ch: 0 }, cursor);
        const index = text.lastIndexOf(trigger);
        const query = text.slice(index + trigger.length);
        return index >= 0 && !query.startsWith("[[") ? {
            start: { line: cursor.line, ch: index },
            end: cursor,
            query
        } 
        : null;
    }
}


export class SearchPreviewModal extends Modal {
    constructor(public app: App, public plugin: MathBooster, public item: MathItem) {
        super(app);
    }

    onOpen(): void {
        const {contentEl, item} = this;
        contentEl.empty();

        const file = this.app.vault.getAbstractFileByPath(item.path);
        if (! (file instanceof TFile)) return;

        const io = getIO(this.plugin, file);
        const sec = this.app.metadataCache.getFileCache(file)?.sections?.find((sec) => sec.id == item.id);

        if (sec) {
            this.renderPreview(io, sec);
        }
    }

    async renderPreview(io: ActiveNoteIO | NonActiveNoteIO, sec: SectionCache) {
        const markdown = await io.getRange(sec.position)
        await MarkdownRenderer.renderMarkdown(markdown, this.contentEl, this.item.path, this.plugin);
    }

    onClose(): void {
        const {contentEl} = this;
        contentEl.empty();       
    }
}