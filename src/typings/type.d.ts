import { PaneType, SplitDirection } from "obsidian";
import { EditorView } from "@codemirror/view";

declare module "obsidian" {
    interface App {
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                [id: string]: any;
                // dataview?: {
                //     api?: DataviewApi;
                // };
            };
            getPlugin: (id: string) => Plugin | null;
            disablePlugin: (id: string) => Promise<void>;
        };
    }
    interface MetadataCache {
        // Custom Events
        on(
            name: "math-booster:index-updated", 
            callback: (file: TFile) => any
        ): EventRef;
        on(
            name: "math-booster:local-settings-updated", 
            callback: (file: TAbstractFile) => any
        ): EventRef;
        on(
            name: "math-booster:global-settings-updated", 
            callback: () => any
        ): EventRef;

        // Dataview Events
        on(
            name: "dataview:index-ready",
            callback: () => any,
            ctx?: any
        ): EventRef;
        on(
            name: "dataview:metadata-change",
            callback: (
                ...args:
                    | [op: "rename", file: TAbstractFile, oldPath: string]
                    | [op: "delete", file: TFile]
                    | [op: "update", file: TFile]
            ) => any,
            ctx?: any
        ): EventRef;
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
}

export type LeafArgs = [newLeaf?: PaneType | boolean] | [newLeaf?: 'split', direction?: SplitDirection];
