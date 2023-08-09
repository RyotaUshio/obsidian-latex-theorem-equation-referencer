import { ActiveNoteIndexer, NonActiveNoteIndexer } from "indexer";
import "obsidian";
import { DataviewApi } from "obsidian-dataview";

declare module "obsidian" {
    interface App {
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                [id: string]: any;
                dataview?: {
                    api?: DataviewApi;
                };
            };
        };
    }
    interface MetadataCache {
        // Custom Events
        on(
            name: "obsidian-math-booster:index-updated", 
            callback: (indexer: ActiveNoteIndexer | NonActiveNoteIndexer) => any
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
}
