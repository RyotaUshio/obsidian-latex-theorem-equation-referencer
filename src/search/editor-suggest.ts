import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";

import MathBooster from "main";
import { MathBoosterBlock } from "index/typings/markdown";
import { MathSearchCore, MathSearchCoreCreator, SuggestParent } from "./core";


export class LinkAutocomplete extends EditorSuggest<MathBoosterBlock> implements SuggestParent {
    core: MathSearchCore;

    /**
     * @param type The type of the block to search for. See: index/typings/markdown.ts
     */
    constructor(public plugin: MathBooster, public triggerGetter: () => string, coreCreator: MathSearchCoreCreator) {
        super(plugin.app);
        this.core = coreCreator(this);
        this.core.setScope();
    }

    getContext() {
        return this.context;
    }

    getSelectedItem() {
        // Reference: https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/blob/be4a12c3f861c31f2be3c0f81809cfc5ab6bb5fd/src/ui/AutoCompleteSuggest.ts#L595-L619
        return this.suggestions.values[this.suggestions.selectedItem];
    }

    onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
        const trigger = this.triggerGetter();
        const text = editor.getLine(cursor.line);
        const index = text.lastIndexOf(trigger);
        if (index < 0) return null;

        const query = text.slice(index + trigger.length);
        this.limit = this.plugin.extraSettings.suggestNumber;
        return !query.startsWith("[[") ? {
            start: { line: cursor.line, ch: index },
            end: cursor,
            query
        } : null;
    }

    getSuggestions(context: EditorSuggestContext): Promise<MathBoosterBlock[]> {
        return this.core.getSuggestions(context.query);
    }

    renderSuggestion(block: MathBoosterBlock, el: HTMLElement): void {
        this.core.renderSuggestion(block, el);
    }

    selectSuggestion(item: MathBoosterBlock, evt: MouseEvent | KeyboardEvent): void {
        this.core.selectSuggestion(item, evt);
    }
}
