import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile, prepareFuzzySearch, sortSearchResults, SearchResult, Scope, MarkdownRenderer, Modal, SectionCache, Notice } from "obsidian";

import MathBooster from "./main";
import { ActiveNoteIO, NonActiveNoteIO, getIO } from './file_io';
import { findSectionCache, insertBlockIdIfNotExist, resolveSettings } from './utils';
import { IndexItem, IndexItemType } from "indexer";


export class TheoremSuggest extends EditorSuggest<IndexItem> {
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

    renderSuggestion(item: IndexItem, el: HTMLElement): void {
        // el.setAttribute("style", "display: inline-block;");
        const base = el.createDiv({ cls: "math-booster-search-item" });
        base.createDiv({ text: item.printName });
        base.createEl("small", { text: `${item.file.path}`, cls: "math-booster-search-item-description" });
    }

    selectSuggestion(item: IndexItem, evt: MouseEvent | KeyboardEvent): void {
        this.selectSuggestionImpl(item);
    }

    async selectSuggestionImpl(item: IndexItem): Promise<void> {
        const cache = this.app.metadataCache.getFileCache(item.file);
        if (this.context && cache) {
            const { editor, start, end, file } = this.context;
            const settings = resolveSettings(undefined, this.plugin, file);
            const secType = item.type == "theorem" ? "callout" : "math";

            const sec = findSectionCache(
                cache,
                (sec) => sec.type == secType && sec.position.start.line == item.cache.position.start.line
            );

            let success = false;

            if (sec) {
                const result = await insertBlockIdIfNotExist(this.plugin, item.file, cache, sec);
                if (result) {
                    const { id, lineAdded } = result;
                    if (item.file == file) {
                        editor.replaceRange(
                            `[[#^${id}]]${settings.insertSpace ? " " : ""}`,
                            { line: start.line + lineAdded, ch: start.ch },
                            { line: end.line + lineAdded, ch: end.ch }
                        );
                    } else {
                        editor.replaceRange(
                            `[[${item.file.path}#^${id}]]${settings.insertSpace ? " " : ""}`,
                            start,
                            end
                        );
                    }
                    success = true;
                }
            }
            if (!success) {
                new Notice(`${this.plugin.manifest.name}: Failed to read cache. Retry again later.`, 5000);
            }
        }
    }

    getSuggestions(context: EditorSuggestContext): IndexItem[] {
        const callback = prepareFuzzySearch(context.query);
        const results: { match: SearchResult, item: IndexItem }[] = [];

        for (const noteIndex of this.plugin.index.data.values()) {
            for (const which of ["theorem", "equation"]) {
                for (const item of noteIndex[which as IndexItemType]) {
                    const result = callback(item.printName);
                    if (result) {
                        results.push({ match: result, item });
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
    constructor(public app: App, public plugin: MathBooster, public item: IndexItem) {
        super(app);
    }

    onOpen(): void {
        const { contentEl, item } = this;
        contentEl.empty();

        const io = getIO(this.plugin, this.item.file);
        const sec = this.app.metadataCache.getFileCache(this.item.file)
            ?.sections
            ?.find((sec) => sec.position.start.line == item.cache.position.start.line);

        if (sec) {
            this.renderPreview(io, sec);
        }
    }

    async renderPreview(io: ActiveNoteIO | NonActiveNoteIO, sec: SectionCache) {
        const markdown = await io.getRange(sec.position)
        await MarkdownRenderer.renderMarkdown(markdown, this.contentEl, this.item.file.path, this.plugin);
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
