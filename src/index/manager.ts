import { App, Component, EventRef, Events, MetadataCache, TAbstractFile, TFile, Vault } from "obsidian";
import { Deferred, deferred } from "./utils/deferred";
import { ImporterSettings } from "../settings/settings";
import { MathImporter } from "./web-worker/importer";
import { MathIndex } from "./index";
import { Indexable } from "./typings/indexable";
import { ImportResult } from "./web-worker/message";
import { MarkdownPage } from "./typings/markdown";
import MathBooster from "../main";
import { iterDescendantFiles } from "utils";
import * as MathLinks from "obsidian-mathlinks";


export class MathIndexManager extends Component {
    app: App;
    /** Access to the obsidian vault. */
    vault: Vault;
    /** Provides access to per-(markdown)-file metadata. */
    metadataCache: MetadataCache;
    /** Datacore events, mainly used to update downstream views. This object is shadowed by the Datacore object itself. */
    events: Events;

    /** In-memory index over all stored metadata. */
    index: MathIndex;
    /** Asynchronous multi-threaded file importer with throttling. */
    importer: MathImporter;
    // /** Local-storage backed cache of metadata objects. */
    // persister: LocalStorageCache;
    /** Only set when the index is in the midst of initialization; tracks current progress. */
    initializer?: MathIndexInitializer;
    /** If true, datacore is fully hydrated and all files have been indexed. */
    initialized: boolean;

    constructor(
        public plugin: MathBooster,
        // public version: string, 
        public settings: ImporterSettings
    ) {
        super();

        const { app } = plugin;
        this.app = app;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        // this.persister = new LocalStorageCache("primary", version);
        this.events = new Events();

        this.index = new MathIndex(plugin, app.vault, app.metadataCache);
        this.initialized = false;

        this.addChild(
            (this.importer = new MathImporter(app.vault, app.metadataCache, () => {
                return {
                    workers: settings.importerNumThreads,
                    utilization: Math.max(0.1, Math.min(1.0, settings.importerUtilization)),
                };
            }))
        );
    }

    /** Obtain the current index revision, for determining if anything has changed. */
    get revision() {
        return this.index.revision;
    }

    /** Initialize datacore by scanning persisted caches and all available files, and queueing parses as needed. */
    initialize() {
        // The metadata cache is updated on initial file index and file loads.
        this.registerEvent(this.metadataCache.on("resolve", (file) => this.updateLinked([file])));
        // Renames do not set off the metadata cache; catch these explicitly.
        this.registerEvent(this.vault.on("rename", this.rename, this));

        // File creation does cause a metadata change, but deletes do not. Clear the caches for this.
        this.registerEvent(
            this.vault.on("delete", (file) => {
                if (file instanceof TFile) {
                    this.index.delete(file.path);
                }
            })
        );

        this.registerEvent(
            this.app.metadataCache.on("math-booster:local-settings-updated", async (file) => {
                const files: TFile[] = [];
                iterDescendantFiles(file, (descendantFile) => {
                    if (descendantFile.extension == "md") files.push(descendantFile)
                });    
                await this.updateLinked(files);
            })
        );

        this.registerEvent(
            this.app.metadataCache.on("math-booster:global-settings-updated", () => {
                // re-index the whole vault
                const init = new MathIndexInitializer(this);
                init.finished().then(() => {
                    this.removeChild(init);
                    this.index.touch();
                    this.trigger("update", this.revision);
                });
            })
        );

        // Asynchronously initialize actual content in the background using a lifecycle-respecting object.
        const init = (this.initializer = new MathIndexInitializer(this));
        init.finished().then((stats: InitializationStats) => {
            this.initialized = true;
            this.initializer = undefined;
            this.removeChild(init);

            const durationSecs = (stats.durationMs / 1000.0).toFixed(3);
            console.log(
                `Math Booster: Imported all theorems and equations in the vault in ${durationSecs}s ` +
                `(${stats.imported} notes imported, ${stats.skipped} notes skipped).`
            );

            this.index.touch();
            this.trigger("update", this.revision);
            MathLinks.update(this.app);
        });

        this.addChild(init);
    }

    private rename(file: TAbstractFile, oldPath: string) {
        if (!(file instanceof TFile)) {
            return;
        }

        // Delete the file at the old path, then request a reload at the new path.
        // This is less optimal than what can probably be done, but paths are used in a bunch of places
        // (for sections, tasks, etc to refer to their parent file) and it requires some finesse to fix.
        this.index.delete(oldPath);
        this.reload(file);
    }

    /** Queue a file for reloading; this is done asynchronously in the background and may take a few seconds. */
    public async reload(file: TFile): Promise<Indexable> {
        const result = await this.importer.import<ImportResult>(file);

        if (result.type === "error") {
            throw new Error(`Failed to import file '${file.name}: ${result.$error}`);
        } else if (result.type === "markdown") {
            const parsed = MarkdownPage.from(result.result, (link) => {
                const rpath = this.metadataCache.getFirstLinkpathDest(link.path, result.result.$path!);
                if (rpath) return link.withPath(rpath.path);
                else return link;
            });

            this.index.store(parsed, (object, store) => {
                store(object.$sections, (section, store) => {
                    store(section.$blocks);
                });
            });

            this.trigger("update", this.revision);
            return parsed;
        }

        throw new Error("Encountered unrecognized import result type: " + (result as any).type);
    }

    /** Given an array of TFiles, this function does two things:
     * 1. It reloads (re-imports) each file in the array.
     * 2. It re-computes the theorem/equation numbers for all the files containing blocks 
     *    that each file in the array previously linked to.
     */
    public async updateLinked(files: TFile[]) {
        // Use Set, not Array, to avoid updating the same file multiple times.
        const toBeUpdated = new Set<TFile>(files);

        // Since only linked/referenced equations are numbered, we need to recompute 
        // the equation numbers for all the files containing blocks 
        // that this file previously linked to.
        const reloadPromises: Promise<Indexable>[] = [];
        for (const file of new Set(files)) {
            const oldPage = this.index.load(file.path);
            if (MarkdownPage.isMarkdownPage(oldPage)) {
                for (const link of oldPage.$links) {
                    if (link.type === "block") {
                        const linkedFile = this.vault.getAbstractFileByPath(link.path);
                        if (linkedFile instanceof TFile) {
                            toBeUpdated.add(linkedFile);
                        }
                    }
                }
            }
            reloadPromises.push(this.reload(file));
        }
        await Promise.all(reloadPromises);
        // recompute theorem/equation numbers for linked files
        toBeUpdated.forEach((fileToBeUpdated) => {
            this.index.updateNames(fileToBeUpdated);
            MathLinks.update(this.app, fileToBeUpdated);
        });
        this.trigger("update", this.revision);
    }

    // Event propogation.

    /** Called whenever the index updates to a new revision. This is the broadest possible datacore event. */
    public on(evt: "update", callback: (revision: number) => any, context?: any): EventRef;

    on(evt: string, callback: (...data: any) => any, context?: any): EventRef {
        return this.events.on(evt, callback, context);
    }

    /** Unsubscribe from an event using the event and original callback. */
    off(evt: string, callback: (...data: any) => any) {
        this.events.off(evt, callback);
    }

    /** Unsubscribe from an event using the event reference.  */
    offref(ref: EventRef) {
        this.events.offref(ref);
    }

    /** Trigger an update event. */
    private trigger(evt: "update", revision: number): void;

    /** Trigger an event. */
    private trigger(evt: string, ...args: any[]): void {
        this.events.trigger(evt, args);
    }
}


/** Lifecycle-respecting file queue which will import files, reading them from the file cache if needed. */
export class MathIndexInitializer extends Component {
    /** Number of concurrent operations the initializer will perform. */
    static BATCH_SIZE: number = 8;

    /** Whether the initializer should continue to run. */
    active: boolean;

    /** Queue of files to still import. */
    queue: TFile[];
    /** The files actively being imported. */
    current: TFile[];
    /** Deferred promise which resolves when importing is done. */
    done: Deferred<InitializationStats>;

    /** The time that init started in milliseconds. */
    start: number;
    /** Total number of files to import. */
    files: number;
    /** Total number of imported files so far. */
    initialized: number;
    /** Total number of imported files. */
    imported: number;
    /** Total number of skipped files. */
    skipped: number;

    constructor(public manager: MathIndexManager) {
        super();

        this.active = false;
        this.queue = this.manager.vault.getMarkdownFiles();
        this.files = this.queue.length;
        this.start = Date.now();
        this.current = [];
        this.done = deferred();

        this.initialized = this.imported = this.skipped = 0;
    }

    async onload() {
        // Queue BATCH_SIZE elements from the queue to import.
        this.active = true;

        this.runNext();
    }

    /** Promise which resolves when the initialization completes. */
    finished(): Promise<InitializationStats> {
        return this.done;
    }

    /** Cancel initialization. */
    onunload() {
        if (this.active) {
            this.active = false;
            this.done.reject("Initialization was cancelled before completing.");
        }
    }

    /** Poll for another task to execute from the queue. */
    private runNext() {
        // Do nothing if max number of concurrent operations already running.
        if (!this.active || this.current.length >= MathIndexInitializer.BATCH_SIZE) {
            return;
        }

        // There is space available to execute another.
        const next = this.queue.pop();
        if (next) {
            this.current.push(next);
            this.init(next)
                .then((result) => this.handleResult(next, result))
                .catch((result) => this.handleResult(next, result));

            this.runNext();
        } else if (!next && this.current.length == 0) {
            this.active = false;

            this.manager.vault.getMarkdownFiles().forEach((file) => this.manager.index.updateNames(file));
            MathLinks.update(this.manager.app);

            // All work is done, resolve.
            this.done.resolve({
                durationMs: Date.now() - this.start,
                files: this.files,
                imported: this.imported,
                skipped: this.skipped,
            });
        }
    }

    /** Process the result of an initialization and queue more runs. */
    private handleResult(file: TFile, result: InitializationResult) {
        this.current.remove(file);
        this.initialized++;

        if (result.status === "skipped") this.skipped++;
        else if (result.status === "imported") this.imported++;

        // Queue more jobs for processing.
        this.runNext();
    }

    /** Initialize a specific file. */
    private async init(file: TFile): Promise<InitializationResult> {
        try {
            const metadata = this.manager.metadataCache.getFileCache(file);
            if (!metadata) return { status: "skipped" };

            await this.manager.reload(file);
            return { status: "imported" };
        } catch (ex) {
            console.log("Math Booster: Failed to import file: ", ex);
            return { status: "skipped" };
        }
    }
}

/** Statistics about a successful vault initialization. */
export interface InitializationStats {
    /** How long initializaton took in miliseconds. */
    durationMs: number;
    /** Total number of files that were imported */
    files: number;
    /** The number of files that were loaded and imported via background workers. */
    imported: number;
    /** The number of files that were skipped due to no longer existing or not being ready. */
    skipped: number;
}

/** The result of initializing a file. */
interface InitializationResult {
    status: "skipped" | "imported";
}
