import { Component, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Keymap, UserEvent } from "obsidian";

import MathBooster from "main";
import { MathBoosterBlock } from "index/typings/markdown";
import { KeyupHandlingHoverParent, MathSearchCore, SuggestParent, WholeVaultTheoremEquationSearchCore } from "./core";
import { QueryType, SearchRange } from './core';


export class LinkAutocomplete extends EditorSuggest<MathBoosterBlock> implements SuggestParent {
    queryType: QueryType;
    range: SearchRange;
    core: MathSearchCore;
    triggers: Map<string, { range: SearchRange, queryType: QueryType }>;
    component: Component;

    /**
     * @param type The type of the block to search for. See: index/typings/markdown.ts
     */
    constructor(public plugin: MathBooster) {
        super(plugin.app);
        this.setTriggers();
        this.core = new WholeVaultTheoremEquationSearchCore(this);
        this.core.setScope();
        this.suggestEl.addClass('math-booster');
        this.plugin.addChild(this.component = new Component());

        this.component.registerDomEvent(window, 'keydown', (event: UserEvent) => {
            // @ts-ignore
            if (this.isOpen && Keymap.isModifier(event, this.plugin.extraSettings.modifierToPreview)) {
                const item = this.getSelectedItem();
                const parent = new KeyupHandlingHoverParent(this);
                this.component.addChild(parent);
                this.app.workspace.trigger('link-hover', parent, null, item.$file, "", { scroll: item.$position.start })
            }
        });
    }

    get dvQuery(): string {
        return this.plugin.extraSettings.autocompleteDvQuery;
    }

    getContext() {
        return this.context;
    }

    getSelectedItem() {
        // Reference: https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/blob/be4a12c3f861c31f2be3c0f81809cfc5ab6bb5fd/src/ui/AutoCompleteSuggest.ts#L595-L619
        return this.suggestions.values[this.suggestions.selectedItem];
    }

    moveUp(event: KeyboardEvent): void {
        // @ts-ignore
        this.suggestions.moveUp(event);
    }

    moveDown(event: KeyboardEvent): void {
        // @ts-ignore
        this.suggestions.moveDown(event);
    }

    onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
        for (const [trigger, { range, queryType }] of this.triggers) {
            const text = editor.getLine(cursor.line);
            const index = text.lastIndexOf(trigger);
            if (index >= 0) {
                const query = text.slice(index + trigger.length);
                if (query.startsWith("[[")) return null; // avoid conflict with the built-in link auto-completion
                this.queryType = queryType;
                this.range = range;
                const core = MathSearchCore.getCore(this);
                if (!core) return null;
                this.core = core;
                this.limit = this.plugin.extraSettings.suggestNumber;
                return {
                    start: { line: cursor.line, ch: index },
                    end: cursor,
                    query
                };
            }
        }

        return null;
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

    setTriggers() {
        const unsortedTriggers = {} as Record<string, { range: SearchRange, queryType: QueryType }>;
        if (this.plugin.extraSettings.enableSuggest) {
            unsortedTriggers[this.plugin.extraSettings.triggerSuggest] = { range: "vault", queryType: "both" };
        }
        if (this.plugin.extraSettings.enableTheoremSuggest) {
            unsortedTriggers[this.plugin.extraSettings.triggerTheoremSuggest] = { range: "vault", queryType: "theorem" };
        }
        if (this.plugin.extraSettings.enableEquationSuggest) {
            unsortedTriggers[this.plugin.extraSettings.triggerEquationSuggest] = { range: "vault", queryType: "equation" };
        }
        if (this.plugin.extraSettings.enableSuggestRecentNotes) {
            unsortedTriggers[this.plugin.extraSettings.triggerSuggestRecentNotes] = { range: "recent", queryType: "both" };
        }
        if (this.plugin.extraSettings.enableTheoremSuggestRecentNotes) {
            unsortedTriggers[this.plugin.extraSettings.triggerTheoremSuggestRecentNotes] = { range: "recent", queryType: "theorem" };
        }
        if (this.plugin.extraSettings.enableEquationSuggestRecentNotes) {
            unsortedTriggers[this.plugin.extraSettings.triggerEquationSuggestRecentNotes] = { range: "recent", queryType: "equation" };
        }
        if (this.plugin.extraSettings.enableSuggestActiveNote) {
            unsortedTriggers[this.plugin.extraSettings.triggerSuggestActiveNote] = { range: "active", queryType: "both" };
        }
        if (this.plugin.extraSettings.enableTheoremSuggestActiveNote) {
            unsortedTriggers[this.plugin.extraSettings.triggerTheoremSuggestActiveNote] = { range: "active", queryType: "theorem" };
        }
        if (this.plugin.extraSettings.enableEquationSuggestActiveNote) {
            unsortedTriggers[this.plugin.extraSettings.triggerEquationSuggestActiveNote] = { range: "active", queryType: "equation" };
        }
        if (this.plugin.extraSettings.enableSuggestDataview) {
            unsortedTriggers[this.plugin.extraSettings.triggerSuggestDataview] = { range: "dataview", queryType: "both" };
        }
        if (this.plugin.extraSettings.enableTheoremSuggestDataview) {
            unsortedTriggers[this.plugin.extraSettings.triggerTheoremSuggestDataview] = { range: "dataview", queryType: "theorem" };
        }
        if (this.plugin.extraSettings.enableEquationSuggestDataview) {
            unsortedTriggers[this.plugin.extraSettings.triggerEquationSuggestDataview] = { range: "dataview", queryType: "equation" };
        }
        const sortedTriggers = new Map<string, { range: SearchRange, queryType: QueryType }>;

        Object.entries(unsortedTriggers)
            .sort((a, b) => b[0].length - a[0].length) // sort by descending order of trigger length
            .forEach(([k, v]) => sortedTriggers.set(k, v));

        this.triggers = sortedTriggers;
    }
}
