import { App, EditorSuggestContext, Instruction, Notice, Scope, SearchResult, TFile, finishRenderMath, prepareFuzzySearch, prepareSimpleSearch, renderMath, sortSearchResults } from 'obsidian';

import LatexReferencer from 'main';
import { MathIndex } from 'index/math-index';
import { EquationBlock, MarkdownBlock, MarkdownPage, MathBlock, TheoremCalloutBlock } from 'index/typings/markdown';
import { getFileTitle } from 'index/utils/normalizers';
import { LEAF_OPTION_TO_ARGS } from 'settings/settings';
import { formatLabel } from 'utils/format';
import { getModifierNameInPlatform, openFileAndSelectPosition } from 'utils/obsidian';
import { insertBlockIdIfNotExist, resolveSettings } from 'utils/plugin';
import { MathSearchModal } from './modal';
import { renderTextWithMath } from 'utils/render';


export type ScoredMathBlock = { match: SearchResult, block: MathBlock };

export type SearchRange = 'active' | 'vault' | 'recent' | 'dataview';
export type QueryType = 'theorem' | 'equation' | 'both';

export type MathSearchCoreCreator = (parent: SuggestParent) => MathSearchCore;

export interface SuggestParent {
    app: App;
    plugin: LatexReferencer;
    scope: Scope;
    range: SearchRange;
    queryType: QueryType;
    dvQuery: string;
    getContext(): Omit<EditorSuggestContext, 'query'> | null;
    setInstructions(instructions: Instruction[]): void;
    getSelectedItem(): MathBlock;
}

export abstract class MathSearchCore {
    app: App;
    plugin: LatexReferencer;
    index: MathIndex;
    scope: Scope;

    constructor(public parent: SuggestParent) {
        this.plugin = parent.plugin;
        this.app = this.plugin.app;
        this.index = this.plugin.indexManager.index;
        this.scope = parent.scope;
    }

    static getCore(parent: SuggestParent): MathSearchCore | null {
        const { app, range, queryType, dvQuery } = parent;
        if (range === 'dataview') {
            const dv = app.plugins.plugins.dataview?.api;
            if (!dv) return null;
            return new DataviewQuerySearchCore(parent, queryType, dv, dvQuery);
        }

        if (range === 'vault') {
            if (queryType === 'both') return new WholeVaultTheoremEquationSearchCore(parent);
            else if (queryType === 'theorem') return new WholeVaultTheoremSearchCore(parent);
            else if (queryType === 'equation') return new WholeVaultEquationSearchCore(parent);
        } else if (range === 'recent') return new RecentNotesSearchCore(parent, queryType);
        else if (range === 'active') return new ActiveNoteSearchCore(parent, queryType);

        return null;
    }

    setScope() {
        // Mod (by default) + Enter to jump to the selected item
        this.scope.register([this.plugin.extraSettings.modifierToJump], "Enter", () => {
            const context = this.parent.getContext();
            if (context) {
                const { editor, start, end } = context;
                editor.replaceRange("", start, end);
            }
            const item = this.parent.getSelectedItem();
            const file = this.app.vault.getAbstractFileByPath(item.$file); // the file containing the selected item
            if (!(file instanceof TFile)) return;
            openFileAndSelectPosition(this.app, file, item.$pos, ...LEAF_OPTION_TO_ARGS[this.plugin.extraSettings.suggestLeafOption]);
            if (this.parent instanceof MathSearchModal) this.parent.close();
            return false;
        });

        // Shift (by default) + Enter to insert a link to the note containing the selected item
        this.scope.register([this.plugin.extraSettings.modifierToNoteLink], "Enter", () => {
            const item = this.parent.getSelectedItem();
            this.selectSuggestionImpl(item, true);
            if (this.parent instanceof MathSearchModal) this.parent.close();
            return false;
        });

        if (this.plugin.extraSettings.showModifierInstruction) {
            this.parent.setInstructions([
                { command: "↑↓", purpose: "to navigate" },
                { command: "↵", purpose: "to insert link" },
                { command: `${getModifierNameInPlatform(this.plugin.extraSettings.modifierToNoteLink)} + ↵`, purpose: "to insert link to note" },
                { command: `${getModifierNameInPlatform(this.plugin.extraSettings.modifierToJump)} + ↵`, purpose: "to jump" },
            ]);
        }
    }

    async getSuggestions(query: string): Promise<MathBlock[]> {
        const ids = await this.getUnsortedSuggestions();
        const results = this.gradeSuggestions(ids, query);
        this.postProcessResults(results);
        sortSearchResults(results);
        return results.map((result) => result.block);
    }

    abstract getUnsortedSuggestions(): Promise<Array<string>> | Promise<Set<string>>;

    postProcessResults(results: ScoredMathBlock[]) { }

    gradeSuggestions(ids: Array<string> | Set<string>, query: string) {
        const callback = (this.plugin.extraSettings.searchMethod == "Fuzzy" ? prepareFuzzySearch : prepareSimpleSearch)(query);
        const results: ScoredMathBlock[] = [];

        for (const id of ids) {
            const block = this.index.load(id) as MathBlock;

            let text = `${block.$printName} ${block.$file}}`;

            if (block.$type === "theorem") {
                text += ` ${(block as TheoremCalloutBlock).$settings.type}`;
                if (this.plugin.extraSettings.searchLabel) {
                    const file = this.app.vault.getAbstractFileByPath(block.$file);
                    if (file instanceof TFile) {
                        const resolvedSettings = resolveSettings((block as TheoremCalloutBlock).$settings, this.plugin, file);
                        text += ` ${formatLabel(resolvedSettings) ?? ""}`
                    }
                }
            } else if (block.$type === "equation") {
                text += " " + (block as EquationBlock).$mathText;
            }

            // run search
            const result = callback(text);
            if (result) {
                results.push({ match: result, block });
            }
        }

        return results;
    }

    renderSuggestion(block: MathBlock, el: HTMLElement): void {
        const baseEl = el.createDiv({ cls: "math-booster-search-item" });
        if (block.$printName) {
            const children = renderTextWithMath(block.$printName);
            baseEl.createDiv()
                .replaceChildren(...children);

        }
        const smallEl = baseEl.createEl(
            "small", {
            text: `${getFileTitle(block.$file)}, line ${block.$position.start + 1}`,
            cls: "math-booster-search-item-description"
        });
        if (block.$type === "equation") {
            if (this.plugin.extraSettings.renderMathInSuggestion) {
                const mjxContainerEl = renderMath((block as EquationBlock).$mathText, true);
                baseEl.insertBefore(mjxContainerEl, smallEl);
            } else {
                const mathTextEl = createDiv({ text: (block as EquationBlock).$mathText });
                baseEl.insertBefore(mathTextEl, smallEl);
            }
        }
    }

    selectSuggestion(item: MathBlock, evt: MouseEvent | KeyboardEvent): void {
        this.selectSuggestionImpl(item, false);
        // I don't know when to call finishRenderMath...
        finishRenderMath();
    }

    async selectSuggestionImpl(block: MathBlock, insertNoteLink: boolean): Promise<void> {
        const context = this.parent.getContext();
        if (!context) return;
        const fileContainingBlock = this.app.vault.getAbstractFileByPath(block.$file);
        const cache = this.app.metadataCache.getCache(block.$file);
        if (!(fileContainingBlock instanceof TFile) || !cache) return;

        const { editor, start, end, file } = context;
        const settings = resolveSettings(undefined, this.plugin, file);
        let success = false;

        const result = await insertBlockIdIfNotExist(this.plugin, fileContainingBlock, cache, block);
        if (result) {
            const { id, lineAdded } = result;
            // We can't use FileManager.generateMarkdownLink here.
            // This is because, when the user is turning off "Use [[Wikilinks]]", 
            // FileManager.generateMarkdownLink inserts a markdown link [](), not a wikilink [[]].
            // Markdown links are hard to deal with for the purpose of this plugin, and also
            // MathLinks has some issues with markdown links (https://github.com/zhaoshenzhai/obsidian-mathlinks/issues/47).
            // So we have to explicitly generate a wikilink here.
            let linktext = "";
            if (fileContainingBlock != file) {
                linktext += this.app.metadataCache.fileToLinktext(fileContainingBlock, file.path);
            }
            if (!insertNoteLink) {
                linktext += `#^${id}`;
            }
            const link = `[[${linktext}]]`
            const insertText = link + (settings.insertSpace ? " " : "");
            if (fileContainingBlock == file) {
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

        if (!success) {
            new Notice(`${this.plugin.manifest.name}: Failed to read cache. Retry again later.`, 5000);
        }
    }
}


abstract class WholeVaultSearchCore extends MathSearchCore {
    postProcessResults(results: ScoredMathBlock[]) {
        results.forEach((result) => {
            if (this.app.workspace.getLastOpenFiles().contains(result.block.$file)) {
                result.match.score += this.plugin.extraSettings.upWeightRecent;
            }
        });
    }
}

export class WholeVaultTheoremEquationSearchCore extends WholeVaultSearchCore {
    async getUnsortedSuggestions(): Promise<Set<string>> {
        return this.index.getByType('block-math-booster');
    }
}

export class WholeVaultTheoremSearchCore extends WholeVaultSearchCore {
    async getUnsortedSuggestions(): Promise<Set<string>> {
        return this.index.getByType('block-theorem');
    }
}

export class WholeVaultEquationSearchCore extends WholeVaultSearchCore {
    async getUnsortedSuggestions(): Promise<Set<string>> {
        return this.index.getByType('block-equation');
    }
}


/** Suggest theorems and/or equations from the given set of files. */
export abstract class PartialSearchCore extends MathSearchCore {
    constructor(parent: SuggestParent, public type: QueryType) {
        super(parent);
    }

    abstract getPaths(): Promise<Array<string>>;

    filterBlock(block: MarkdownBlock): boolean {
        if (this.type === 'theorem') return TheoremCalloutBlock.isTheoremCalloutBlock(block);
        if (this.type === 'equation') return EquationBlock.isEquationBlock(block);
        return MathBlock.isMathBlock(block);
    }

    async getUnsortedSuggestions() {
        const ids: string[] = [];
        const pages = (await this.getPaths()).map((path) => this.index.load(path));
        for (const page of pages) {
            if (!MarkdownPage.isMarkdownPage(page)) continue;

            for (const section of page.$sections) {
                for (const block of section.$blocks) {
                    if (this.filterBlock(block)) ids.push(block.$id);
                }
            }
        }
        return ids;
    }
}


export class RecentNotesSearchCore extends PartialSearchCore {
    async getPaths() {
        return this.app.workspace.getLastOpenFiles();
    }
}


export class ActiveNoteSearchCore extends PartialSearchCore {
    async getPaths() {
        const path = this.app.workspace.getActiveFile()?.path;
        return path?.endsWith('.md') ? [path] : [];
    }
}

export class DataviewQuerySearchCore extends PartialSearchCore {
    public dvQuery: string;

    constructor(parent: SuggestParent, type: 'theorem' | 'equation' | 'both', public dv: any, dvQuery?: string) {
        super(parent, type);
        this.dvQuery = dvQuery ?? '';
    }

    async getPaths() {
        const result = await this.dv.query(this.dvQuery);
        if (result.successful && result.value.type === 'list') {
            const links = result.value.values as { path: string }[];
            return links.map((link) => link.path);
        }
        return [];
    }
}
