import { EditorView } from '@codemirror/view';
import { BlockSubpathResult, CachedMetadata, Component, HeadingSubpathResult, MarkdownPostProcessorContext, MarkdownView, Modifier, Platform, Plugin, Pos, SectionCache, parseLinktext, resolveSubpath } from "obsidian";
import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { locToEditorPosition } from 'utils/editor';
import { LeafArgs } from 'typings/type';

////////////////////
// File utilities //
////////////////////

/**
 * Similar to Vault.recurseChildren, but this function can be also called for TFile, not just TFolder.
 * Also, the callback is only called for TFile.
 */
export function iterDescendantFiles(file: TAbstractFile, callback: (descendantFile: TFile) => any) {
    if (file instanceof TFile) {
        callback(file);
    } else if (file instanceof TFolder) {
        for (const child of file.children) {
            iterDescendantFiles(child, callback);
        }
    }
}

export function getAncestors(file: TAbstractFile): TAbstractFile[] {
    const ancestors: TAbstractFile[] = [];
    let ancestor: TAbstractFile | null = file;
    while (ancestor) {
        ancestors.push(ancestor);
        if (file instanceof TFolder && file.isRoot()) {
            break;
        }
        ancestor = ancestor.parent;
    }
    ancestors.reverse();
    return ancestors;
}

export function isEqualToOrChildOf(file1: TAbstractFile, file2: TAbstractFile): boolean {
    if (file1 == file2) {
        return true;
    }
    if (file2 instanceof TFolder && file2.isRoot()) {
        return true;
    }
    let ancestor = file1.parent;
    while (true) {
        if (ancestor == file2) {
            return true;
        }
        if (ancestor) {
            if (ancestor.isRoot()) {
                return false;
            }
            ancestor = ancestor.parent
        }
    }
}

//////////////////////
// Cache & metadata //
//////////////////////

export function getSectionCacheFromPos(cache: CachedMetadata, pos: number, type: string): SectionCache | undefined {
    // pos: CodeMirror offset units
    if (cache.sections) {
        const sectionCache = Object.values(cache.sections).find((sectionCache) =>
            sectionCache.type == type
            && (sectionCache.position.start.offset == pos || sectionCache.position.end.offset == pos)
        );
        return sectionCache;
    }
}

export function getSectionCacheOfDOM(el: HTMLElement, type: string, view: EditorView, cache: CachedMetadata) {
    const pos = view.posAtDOM(el);
    return getSectionCacheFromPos(cache, pos, type);
}

export function getSectionCacheFromMouseEvent(event: MouseEvent, type: string, view: EditorView, cache: CachedMetadata) {
    const pos = view.posAtCoords(event) ?? view.posAtCoords(event, false);
    return getSectionCacheFromPos(cache, pos, type);
}

export function getProperty(app: App, file: TFile, name: string) {
    return app.metadataCache.getFileCache(file)?.frontmatter?.[name];
}

export function getPropertyLink(app: App, file: TFile, name: string) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatterLinks) {
        for (const link of cache.frontmatterLinks) {
            if (link.key == name) {
                return link;
            }
        }
    }
}

export function getPropertyOrLinkTextInProperty(app: App, file: TFile, name: string) {
    return getPropertyLink(app, file, name)?.link ?? getProperty(app, file, name);
}

export function generateBlockID(cache: CachedMetadata, length: number = 6): string {
    let id = '';

    while (true) {
        // Reference: https://stackoverflow.com/a/58326357/13613783
        id = [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        if (cache?.blocks && id in cache.blocks) {
            continue;
        } else {
            break;
        }
    }
    return id;
}

export function resolveLinktext(app: App, linktext: string, sourcePath: string): { file: TFile, subpathResult: HeadingSubpathResult | BlockSubpathResult | null } | null {
    const { path, subpath } = parseLinktext(linktext);
    const targetFile = app.metadataCache.getFirstLinkpathDest(path, sourcePath);
    if (!targetFile) return null;
    const targetCache = app.metadataCache.getFileCache(targetFile);
    if (!targetCache) return null;
    const result = resolveSubpath(targetCache, subpath);
    return { file: targetFile, subpathResult: result };
}


///////////////////
// Markdown view //
///////////////////

export function getMarkdownPreviewViewEl(view: MarkdownView) {
    return Array.from(view.previewMode.containerEl.children).find((child) => child.matches(".markdown-preview-view"));
}

export function getMarkdownSourceViewEl(view: MarkdownView) {
    const firstCandidate = view.editor.cm?.dom.parentElement;
    if (firstCandidate) return firstCandidate;
    const secondCandidate = view.previewMode.containerEl.previousSibling;
    if (secondCandidate instanceof HTMLElement && secondCandidate.matches(".markdown-source-view")) {
        return secondCandidate;
    }
}

export async function openFileAndSelectPosition(app: App, file: TFile, position: Pos, ...leafArgs: LeafArgs) {
    // @ts-ignore
    const leaf = app.workspace.getLeaf(...leafArgs);
    await leaf.openFile(file);
    if (leaf.view instanceof MarkdownView) {
        // Editing view
        const editor = leaf.view.editor;
        const from = locToEditorPosition(position.start);
        const to = locToEditorPosition(position.end);

        editor.setSelection(from, to);
        editor.scrollIntoView({ from, to }, true);

        // Reading view: thank you NothingIsLost (https://discord.com/channels/686053708261228577/840286264964022302/952218718711189554)
        leaf.view.setEphemeralState({ line: position.start.line });
    }
}

export function findBlockFromReadingViewDom(sizerEl: HTMLElement, cb: (div: HTMLElement, index: number) => boolean): HTMLElement | undefined {
    let index = 0;
    for (const div of sizerEl.querySelectorAll<HTMLElement>(':scope > div')) {
        if (div.classList.contains('markdown-preview-pusher')) continue;
        if (div.classList.contains('mod-header')) continue;
        if (div.classList.contains('mod-footer')) continue;

        if (cb(div, index++)) return div;
    }
}

/**
 * Given a HTMLElement passed to a MarkdownPostProcessor, check if the current context is PDF export of not.
 */
export function isPdfExport(el: HTMLElement): boolean {
    // el.classList.contains('markdown-rendered') is true not only for PDf export
    // but also CM6 decorations in Live Preview whose widgets are rendered by MarkdownRenderer.
    // So we need to check '.print', too.
    // el.closest('[src]') === null is necessary to exclude embeds inside a note exported to PDF.
    // return el.closest('.print') !== null && el.closest('[src]') === null && el.classList.contains('markdown-rendered');

    // Come to think about it, just the following would suffice:
    return (el.parentElement?.classList.contains('print') ?? false) && el.matches('.markdown-preview-view.markdown-rendered');
}

////////////
// Others //
////////////

// compare the version of given plugin and the required version
export function isPluginOlderThan(plugin: Plugin, version: string): boolean {
    return plugin.manifest.version.localeCompare(version, undefined, { numeric: true }) < 0;
}

export function getModifierNameInPlatform(mod: Modifier): string {
    if (mod == "Mod") {
        return Platform.isMacOS || Platform.isIosApp ? "⌘" : "ctrl";
    }
    if (mod == "Shift") {
        return "shift";
    }
    if (mod == "Alt") {
        return Platform.isMacOS || Platform.isIosApp ? "⌥" : "alt";
    }
    if (mod == "Meta") {
        return Platform.isMacOS || Platform.isIosApp ? "⌘" : Platform.isWin ? "win" : "meta";
    }
    return "ctrl";
}


export class MutationObservingChild extends Component {
    observer: MutationObserver;

    constructor(public targetEl: HTMLElement, public callback: MutationCallback, public options: MutationObserverInit) {
        super();
        this.observer = new MutationObserver(callback);
    }

    onload() {
        this.observer.observe(this.targetEl, this.options);
    }

    onunload() {
        this.observer.disconnect();
    }
}
