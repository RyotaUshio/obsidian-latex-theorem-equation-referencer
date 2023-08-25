import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile, prepareFuzzySearch, sortSearchResults, SearchResult, MarkdownRenderer, Modal, SectionCache, Notice, prepareSimpleSearch, renderMath, finishRenderMath } from "obsidian";

import MathBooster from "./main";
import { ActiveNoteIO, NonActiveNoteIO, getIO } from './file_io';
import { findSectionCache, formatLabel, insertBlockIdIfNotExist, openFileAndSelectPosition, resolveSettings } from './utils';
import { IndexItem, IndexItemType, NoteIndex } from "indexer";
import { DEFAULT_EXTRA_SETTINGS, LEAF_OPTION_TO_ARGS } from "settings/settings";


export class Suggest extends EditorSuggest<IndexItem> {
    constructor(public app: App, public plugin: MathBooster, public types: IndexItemType[]) {
        super(app);
        this.scope.register([this.plugin.extraSettings.modifierToJump], "Enter", () => {
            // Reference: https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/blob/be4a12c3f861c31f2be3c0f81809cfc5ab6bb5fd/src/ui/AutoCompleteSuggest.ts#L595-L619
            const item = this.suggestions.values[this.suggestions.selectedItem];
            openFileAndSelectPosition(item.file, item.cache.position, ...LEAF_OPTION_TO_ARGS[this.plugin.extraSettings.suggestLeafOption]);
            return false;
        });
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        const trigger = this.types.contains("theorem")
            ? (this.types.contains("equation")
                ? (this.plugin.extraSettings.triggerSuggest ?? DEFAULT_EXTRA_SETTINGS.triggerSuggest)
                : (this.plugin.extraSettings.triggerTheoremSuggest ?? DEFAULT_EXTRA_SETTINGS.triggerTheoremSuggest))
            : (this.plugin.extraSettings.triggerEquationSuggest ?? DEFAULT_EXTRA_SETTINGS.triggerEquationSuggest);
        const text = editor.getRange({ line: cursor.line, ch: 0 }, cursor);
        const index = text.lastIndexOf(trigger);
        const query = text.slice(index + trigger.length);
        return index >= 0 && !query.startsWith("[[") ? {
            start: { line: cursor.line, ch: index },
            end: cursor,
            query
        } : null;
    }

    getSuggestions(context: EditorSuggestContext): IndexItem[] {
        const callback = (this.plugin.extraSettings.searchMethod == "Fuzzy" ? prepareFuzzySearch : prepareSimpleSearch)(context.query);
        const results: { match: SearchResult, item: IndexItem }[] = [];

        const recentFilePaths = this.app.workspace.getLastOpenFiles();

        if (this.plugin.extraSettings.searchOnlyRecent) {
            const recentFiles = recentFilePaths.map((path) => this.app.vault.getAbstractFileByPath(path));
            for (const file of recentFiles) {
                if (file instanceof TFile) {
                    const noteIndex = this.plugin.index.getNoteIndex(file);
                    this.getSuggestionsImpl(noteIndex, results, callback);
                }
            }
        } else {
            for (const noteIndex of this.plugin.index.data.values()) {
                this.getSuggestionsImpl(noteIndex, results, callback);
            }
        }

        if (!this.plugin.extraSettings.searchOnlyRecent) {
            results.forEach((result) => {
                if (recentFilePaths.contains(result.item.file.path)) {
                    result.match.score += this.plugin.extraSettings.upWeightRecent;
                }
            });
        }

        sortSearchResults(results);
        return results.map((result) => result.item);
    }

    getSuggestionsImpl(noteIndex: NoteIndex, results: { match: SearchResult, item: IndexItem }[], callback: (text: string) => SearchResult | null) {
        for (const which of this.types) {
            for (const item of noteIndex[which as IndexItemType]) {
                let text = `${item.printName} ${item.file.path}`;
                if (item.type == "theorem" && item.settings) {
                    const settings = resolveSettings(item.settings, this.plugin, item.file);
                    text += ` ${formatLabel(settings) ?? ""}`
                } else if (item.type == "equation" && item.mathText) {
                    text += " " + item.mathText;
                }
                const result = callback(text);
                if (result) {
                    results.push({ match: result, item });
                }
            }
        }
    }

    renderSuggestion(item: IndexItem, el: HTMLElement): void {
        // el.setAttribute("style", "display: inline-block;");
        const baseEl = el.createDiv({ cls: "math-booster-search-item" });
        if (item.printName) {
            baseEl.createDiv({ text: item.printName });
        }
        const smallEl = baseEl.createEl(
            "small", {
            text: `${item.file.path.slice(0, - item.file.extension.length - 1)}`,
            cls: "math-booster-search-item-description"
        });
        if (item.type == "equation" && item.mathText) {
            if (this.plugin.extraSettings.renderMathInSuggestion) {
                const mjxContainerEl = renderMath(item.mathText, true);
                baseEl.insertBefore(mjxContainerEl, smallEl);
                finishRenderMath();
            } else {
                const mathTextEl = createDiv({ text: item.mathText });
                baseEl.insertBefore(mathTextEl, smallEl);
            }
        }
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
                    const link = this.app.fileManager.generateMarkdownLink(item.file, file.path, `#^${id}`);
                    const insertText = link + (settings.insertSpace ? " " : "");
                    if (item.file == file) {
                        editor.replaceRange(
                            insertText,
                            { line: start.line + lineAdded, ch: start.ch },
                            { line: end.line + lineAdded, ch: end.ch }
                        );
                    } else {
                        editor.replaceRange(insertText, start, end);
                    }
                    success = true;
                }
            }
            if (!success) {
                new Notice(`${this.plugin.manifest.name}: Failed to read cache. Retry again later.`, 5000);
            }
        }
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
