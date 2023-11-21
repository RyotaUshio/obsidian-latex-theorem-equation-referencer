import { MetadataCache, TFile, Vault } from 'obsidian';

import { InvertedIndex } from './storage/inverted';
import { Indexable, LINKBEARING_TYPE, Linkable } from './typings/indexable';
import { Link } from 'index/expression/literal';
import { EquationBlock, MarkdownPage, TheoremCalloutBlock } from './typings/markdown';

import MathBooster from 'main';
import { CONVERTER, formatTitle, formatTitleWithoutSubtitle, getEqNumberPrefix } from 'utils/format';
import { resolveSettings } from 'utils/plugin';
import { ResolvedMathSettings, TheoremRefFormat } from 'settings/settings';


export class MathIndex {
    /** The current store revision. */
    public revision: number;
    /**
     * Master collection of all object IDs. This is technically redundant with objects.keys() but this is a fast set
     * compared to an iterator.
     */
    private ids: Set<string>;
    /** The master collection of ALL indexed objects, mapping ID -> the object. */
    private objects: Map<string, Indexable>;
    /** Map parent object to it's direct child objects. */
    private children: Map<string, Set<string>>;

    // Indices for the various accepted query types. These will probably be moved to a different type later.
    /** Global map of object type -> list of all objects of that type. */
    private types: InvertedIndex<string>;
    // /** Tracks exact tag occurence in objects. */
    // private etags: InvertedIndex<string>;
    // /** Tracks tag occurence in objects. */
    // private tags: InvertedIndex<string>;
    /** Maps link strings to the object IDs that link to those links. */
    private links: InvertedIndex<string>;
    /** Tracks the existence of fields (indexed by normalized key name). */
    // private fields: Map<string, FieldIndex>; // irrelevant because we are not going to search/query
    /**
     * Quick searches for objects in folders. This index only tracks top-level objects - it is expanded recursively to
     * find child objects.
     */
    // private folder: FolderIndex; // irrelevant because we are not going to search/query

    public constructor(public plugin: MathBooster, public vault: Vault, public metadataCache: MetadataCache,
        // public settings: Settings // irrelevant because we are not going to search/query
    ) {
        this.revision = 0;
        this.ids = new Set();
        this.objects = new Map();
        this.children = new Map();

        this.types = new InvertedIndex();
        // this.etags = new InvertedIndex();
        // this.tags = new InvertedIndex();
        this.links = new InvertedIndex();
        // this.fields = new Map();
        // this.folder = new FolderIndex(vault);
    }

    /** Update the revision of the datastore due to an external update. */
    public touch() {
        this.revision += 1;
    }

    /** Load an object by ID. */
    public load(id: string): Indexable | undefined;
    /** Load a list of objects by ID. */
    public load(ids: string[]): Indexable[];

    /** Load an object by ID or list of IDs. */
    load(id: string | string[]): Indexable | Indexable[] | undefined {
        if (Array.isArray(id)) {
            return id.map((a) => this.load(a)).filter((obj): obj is Indexable => obj !== undefined);
        }

        return this.objects.get(id);
    }

    /**
     * Store the given object, making it immediately queryable. Storing an object
     * takes ownership over it, and index-specific variables (prefixed via '$') may be
     * added to the object.
     */
    public store<T extends Indexable>(object: T | T[], substorer?: Substorer<T>) {
        this._recursiveStore(object, this.revision++, substorer, undefined);
    }

    /** Recursively store objects using a potential subindexer. */
    private _recursiveStore<T extends Indexable>(
        object: T | T[],
        revision: number,
        substorer?: Substorer<T>,
        parent?: Indexable
    ) {
        // Handle array inputs.
        if (Array.isArray(object)) {
            for (let element of object) {
                this._recursiveStore(element, revision, substorer, parent);
            }

            return;
        }

        // Delete the previous instance of this object if present.
        // TODO: Probably only actually need to delete the root objects.
        this._deleteRecursive(object.$id);

        // Assign the next revision to this object; indexed objects are implied to be root objects.
        object.$revision = revision;
        object.$parent = parent;

        // Add the object to the appropriate object maps.
        this.ids.add(object.$id);
        this.objects.set(object.$id, object);

        // Add the object to the parent children map.
        if (parent) {
            if (!this.children.has(parent.$id)) this.children.set(parent.$id, new Set());
            this.children.get(parent.$id)!.add(object.$id);
        }

        this._index(object);

        // Index any subordinate objects in this object.
        substorer?.(object, (incoming, subindex) => this._recursiveStore(incoming, revision, subindex, object));
    }

    /** Delete an object by ID from the index, recursively deleting any child objects as well. */
    public delete(id: string): boolean {
        if (this._deleteRecursive(id)) {
            this.revision++;
            return true;
        }

        return false;
    }

    /** Internal method that does not bump the revision. */
    private _deleteRecursive(id: string): boolean {
        const object = this.objects.get(id);
        if (!object) {
            return false;
        }

        // Recursively delete all child objects.
        const children = this.children.get(id);
        if (children) {
            for (let child of children) {
                this._deleteRecursive(child);
            }

            this.children.delete(id);
        }

        // Drop this object from the appropriate maps.
        this._unindex(object);
        this.ids.delete(id);
        this.objects.delete(id);
        return true;
    }

    /** Add the given indexable to the appropriate indices. */
    private _index(object: Indexable) {
        this.types.set(object.$id, object.$types);

        // // Exact and derived tags.
        // if (object.$types.contains(TAGGABLE_TYPE) && iterableExists(object, "$tags")) {
        //     const tags = object.$tags as Set<string>;

        //     this.etags.set(object.$id, tags);
        //     this.tags.set(object.$id, extractSubtags(tags));
        // }

        // Exact and derived links.
        if (object.$types.contains(LINKBEARING_TYPE) && iterableExists(object, "$links")) {
            this.links.set(
                object.$id,
                (object.$links as Link[]).map((link) => link.obsidianLink())
            );
        }

        // // All fields on an object.
        // if (object.$types.contains(FIELDBEARING_TYPE) && "fields" in object) {
        //     for (const field of object.fields as Iterable<Field>) {
        //         // Skip any index fields.
        //         if (INDEX_FIELDS.has(field.key)) continue;

        //         const norm = field.key.toLowerCase();
        //         if (!this.fields.has(norm)) this.fields.set(norm, new FieldIndex(false));

        //         this.fields.get(norm)!.add(object.$id, field.value);
        //     }
        // }
    }

    /** Remove the given indexable from all indices. */
    private _unindex(object: Indexable) {
        this.types.delete(object.$id, object.$types);

        // if (object.$types.contains(TAGGABLE_TYPE) && iterableExists(object, "$tags")) {
        //     const tags = object.$tags as Set<string>;

        //     this.etags.delete(object.$id, tags);
        //     this.tags.delete(object.$id, extractSubtags(tags));
        // }

        if (object.$types.contains(LINKBEARING_TYPE) && iterableExists(object, "$links")) {
            // Assume links are normalized when deleting them. Could be broken but I hope not. We can always use a 2-way index to
            // fix this if we encounter non-normalized links.
            this.links.delete(
                object.$id,
                (object.$links as Link[]).map((link) => link.obsidianLink())
            );
        }

        // if (object.$types.contains(FIELDBEARING_TYPE) && "fields" in object) {
        //     for (const field of object.fields as Iterable<Field>) {
        //         // Skip any index fields.
        //         if (INDEX_FIELDS.has(field.key)) continue;

        //         const norm = field.key.toLowerCase();
        //         if (!this.fields.has(norm)) continue;

        //         this.fields.get(norm)!.delete(object.$id, field.value);
        //     }
        // }
    }

    /** Completely clear the datastore of all values. */
    public clear() {
        this.ids.clear();
        this.objects.clear();
        this.children.clear();

        this.types.clear();
        // this.tags.clear();
        // this.etags.clear();
        this.links.clear();
        // this.fields.clear();

        this.revision++;
    }

    /** Get all the backlinks to the given linkable. */
    public getBacklinks(object: Linkable) {
        const normalizedLink = object.$link.obsidianLink();
        return this.links.get(normalizedLink);
    }

    /** Check if the given linkable object has any backlinks. */
    public isLinked(object: Linkable): boolean {
        return this.getBacklinks(object).size > 0;
    }

    /**
     * Update $printName and $refName of theorems and equations.
     * Additionally, set $main of a theorem callout to true if it is the only one in the file, if configured as such.
     * Fiinally, set $refName of the page to the refName of the main theorem, if it exists.
     * 
     * Warning: This function doesn't trigger MathLinks.update(), so you have to call it by yourself!
     */
    public updateNames(file: TFile) {
        const settings = resolveSettings(undefined, this.plugin, file);
        
        let blockOrdinal = 1;
        let block: Indexable | undefined;

        let theorems: TheoremCalloutBlock[] = []
        let autoNumberedTheoremCount = 0;
        let mainTheorem: TheoremCalloutBlock | null = null;

        let equationNumber = +(settings.eqNumberInit);
        const eqPrefix = getEqNumberPrefix(this.plugin.app, file, settings);
        const eqSuffix = settings.eqNumberSuffix;

        while (block = this.load(`${file.path}/block${blockOrdinal++}`)) {
            if (TheoremCalloutBlock.isTheoremCalloutBlock(block)) {
                theorems.push(block);
                if (block.$main) mainTheorem = block;
                // Theorem numbers start at 1, and are incremented by 1 
                // for each theorem callout.
                // They may be additionally formatted according to the settings.
                const resolvedSettings = Object.assign({}, settings, block.$settings);
                if (block.$settings.number == 'auto') (resolvedSettings as ResolvedMathSettings)._index = autoNumberedTheoremCount++;
                // const printName = formatTitle(this.plugin, file, resolvedSettings);
                const mainTitle = formatTitleWithoutSubtitle(this.plugin, file, resolvedSettings);
                const refName = this.formatMathLink(file, resolvedSettings, "refFormat");
                block.$theoremMainTitle = mainTitle;
                block.$refName = refName;
                block.$titleSuffix = settings.titleSuffix;
            } else if (EquationBlock.isEquationBlock(block)) {
                // Equation numbers start at settings.eqNumberInit, and are incremented by 1
                // for eqch equation block that doesn't have a manual tag (i.e. \tag{...}) but
                // has any backlinks.
                // If an equation block has a manual tag, it is used as printNames & refNames.
                let printName: string | null = null;
                let refName: string | null = null;
                if (block.$manualTag) {
                    printName = `(${block.$manualTag})`;
                } else if (block.$link && this.isLinked(block as Linkable)) {
                    printName = "(" + eqPrefix + CONVERTER[settings.eqNumberStyle](equationNumber) + eqSuffix + ")";
                    equationNumber++;
                }
                if (printName !== null) refName = settings.eqRefPrefix + printName + settings.eqRefSuffix;
                block.$printName = printName;
                block.$refName = refName;
            }
        }

        if (this.plugin.extraSettings.setOnlyTheoremAsMain && theorems.length == 1) {
            theorems[0].$main = true;
            mainTheorem = theorems[0];
        }

        const page = this.load(file.path);
        if (MarkdownPage.isMarkdownPage(page)) page.$refName = mainTheorem?.$refName ?? undefined;

        this.plugin.app.metadataCache.trigger("math-booster:index-updated", file);
    }

    formatMathLink(file: TFile, resolvedSettings: ResolvedMathSettings, key: "refFormat" | "noteMathLinkFormat"): string {
        const refFormat: TheoremRefFormat = resolvedSettings[key];
        if (refFormat == "[type] [number] ([title])") {
            return formatTitle(this.plugin, file, resolvedSettings, true);
        }
        if (refFormat == "[type] [number]") {
            return formatTitleWithoutSubtitle(this.plugin, file, resolvedSettings);
        }
        if (refFormat == "[title] if title exists, [type] [number] otherwise") {
            return resolvedSettings.title ? resolvedSettings.title : formatTitleWithoutSubtitle(this.plugin, file, resolvedSettings);
        }
        // if (refFormat == "[title] ([type] [number]) if title exists, [type] [number] otherwise") 
        const typePlusNumber = formatTitleWithoutSubtitle(this.plugin, file, resolvedSettings);
        return resolvedSettings.title ? `${resolvedSettings.title} (${typePlusNumber})` : typePlusNumber;
    }

    getByType(type: string) {
        return this.types.get(type);
    }
}

/** A general function for storing sub-objects in a given object. */
export type Substorer<T extends Indexable> = (
    object: T,
    add: <U extends Indexable>(object: U | U[], subindex?: Substorer<U>) => void
) => void;

/** Type guard which checks if object[key] exists and is an iterable. */
function iterableExists<T extends Record<string, any>, K extends string>(
    object: T,
    key: K
): object is T & Record<K, Iterable<any>> {
    return key in object && object[key] !== undefined && Symbol.iterator in object[key];
}
