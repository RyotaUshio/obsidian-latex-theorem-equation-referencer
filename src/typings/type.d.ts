import { PaneType, SplitDirection } from "obsidian";
import { EditorView } from "@codemirror/view";

declare module "obsidian" {
    interface App {
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                [id: string]: any;
            };
            getPlugin: (id: string) => Plugin | null;
        };
    }
    interface Editor {
        cm?: EditorView;
    }
    // Reference: https://github.com/tadashi-aikawa/obsidian-various-complements-plugin/blob/be4a12c3f861c31f2be3c0f81809cfc5ab6bb5fd/src/ui/AutoCompleteSuggest.ts#L595-L619
    interface EditorSuggest<T> {
        scope: Scope;
        suggestions: {
            selectedItem: number;
            values: T[];
            containerEl: HTMLElement;
        };
        suggestEl: HTMLElement;
    }

    // Reference: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/blob/6aa40a46fe817d25c11847a46ec6c765c742d629/src/ui/UnsafeModalInterface.ts#L5
    interface SuggestModal<T> {
        chooser: {
            values: T[] | null;
            selectedItem: number;
            setSelectedItem(
                item: number,
                event?: KeyboardEvent,
            ): void;
            useSelectedItem(ev: Partial<KeyboardEvent>): void;
            suggestions: Element[];
        };
    }
}

export type LeafArgs = [newLeaf?: PaneType | boolean] | [newLeaf?: 'split', direction?: SplitDirection];
