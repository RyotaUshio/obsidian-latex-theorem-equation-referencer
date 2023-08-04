import { EditorState } from '@codemirror/state';
import { SyntaxNodeRef } from '@lezer/common';

// Generic utility functions handing files.

import { App, TFile, getLinkpath, LinkCache, MarkdownView, renderMath, finishRenderMath, TAbstractFile, TFolder, TextFileView, EditorPosition, Loc, CachedMetadata, SectionCache } from 'obsidian';


export function validateLinktext(text: string): string {
    // "[[Filename#Heading]]" --> "Filename#Heading"
    let len = text.length;
    if (text[0] == '[' && text[0] == '[' && text[len - 2] == ']' && text[len - 1] == ']') {
        return text.slice(2, len - 2);
    }
    return text;
}

export function linktext2TFile(app: App, linktext: string): TFile {
    linktext = validateLinktext(linktext);
    let linkpath = getLinkpath(linktext);
    let file = app.metadataCache.getFirstLinkpathDest(linkpath, "");
    if (file) {
        return file;
    }
    throw Error(`Could not resolve path: ${linkpath}`);
}


export function getLinksAndEmbedsInFile(app: App, file: TFile): { links: string[] | undefined, embeds: string[] | undefined } {
    let cache = app.metadataCache.getFileCache(file);
    if (cache) {
        let { links, embeds } = cache;
        let linkStrings;
        let embedStrings
        if (links) {
            linkStrings = links.map((item: LinkCache): string => item.link);
        }
        if (embeds) {
            embedStrings = embeds.map((item: LinkCache): string => item.link);
        }
        return { links: linkStrings, embeds: embedStrings };
    }
    throw Error(`Could not get cached links in ${file.path}`);
}


export function getCurrentMarkdown(app: App): TFile {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
        return activeView.file;
    }
    throw Error(`file is not passed, and markdown view is not active`);
}



export function increaseQuoteLevel(content: string): string {
    let lines = content.split("\n");
    lines = lines.map((line) => "> " + line);
    return lines.join("\n");
}



export async function renderTextWithMath(source: string): Promise<(HTMLElement | string)[]> {
    // Obsidian API's renderMath only can render math itself, but not a text with math in it.
    // e.g., it can handle "\\sqrt{x}", but cannot "$\\sqrt{x}$ is a square root"

    let elements: (HTMLElement | string)[] = [];

    let mathPattern = /\$(.*?[^\s])\$/g;
    let result;
    let textFrom = 0;
    let textTo = 0;
    while ((result = mathPattern.exec(source)) !== null) {
        let match = result[0];
        let mathString = result[1];
        textTo = result.index;
        if (textTo > textFrom) {
            elements.push(source.slice(textFrom, textTo));
        }
        textFrom = mathPattern.lastIndex;

        let mathJaxEl = renderMath(mathString, false);
        await finishRenderMath();

        let mathSpan = createSpan({ cls: ["math", "math-inline", "is-loaded"] });
        mathSpan.replaceChildren(mathJaxEl);
        elements.push(mathSpan);
    }

    if (textFrom < source.length) {
        elements.push(source.slice(textFrom));
    }

    return elements;

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



// // https://github.com/wei2912/obsidian-latex/blob/e71e2bbf459354f9768ba90c7717114fc5f2b177/main.ts#L21C3-L33C1
// export async function loadPreamble(preamblePath: string) {
//     const preamble = await this.app.vault.adapter.read(preamblePath);

//     if (MathJax.tex2chtml == undefined) {
//         MathJax.startup.ready = () => {
//             MathJax.startup.defaultReady();
//             MathJax.tex2chtml(preamble);
//         };
//     } else {
//         MathJax.tex2chtml(preamble);
//     }
// }


export function getActiveTextView(app: App): TextFileView | null {
    let view = app.workspace.getActiveViewOfType(TextFileView);
    if (!view) {
        return null;
    }

    return view;
}


export function generateBlockID(app: App, length: number = 6): string {
    // https://stackoverflow.com/a/58326357/13613783
    let id = '';
    let file = getCurrentMarkdown(app);
    let cache = app.metadataCache.getFileCache(file);

    while (true) {
        id = [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        if (cache && cache.blocks && id in cache.blocks) {
            continue;
        } else {
            break;
        }
    }
    return id;
}


export function locToEditorPosition(loc: Loc): EditorPosition {
    return { ch: loc.col, line: loc.line };
}



export function getMathCache(cache: CachedMetadata, lineStart: number): SectionCache | undefined {
    if (cache.sections) {
        let sectionCache = Object.values(cache.sections).find((sectionCache) =>
            sectionCache.type == 'math'
            && sectionCache.position.start.line == lineStart
        );
        return sectionCache;
    }
}


export function getMathCacheFromPos(cache: CachedMetadata, pos: number): SectionCache | undefined {
    // pos: CodeMirror offset units
    if (cache.sections) {
        let sectionCache = Object.values(cache.sections).find((sectionCache) =>
            sectionCache.type == 'math'
            && (sectionCache.position.start.offset == pos || sectionCache.position.end.offset == pos)
        );
        return sectionCache;
    }
}

export function getMathTag(cache: CachedMetadata, mathCache: SectionCache): string {
    let tag = '';
    if (mathCache?.id && cache.frontmatter) {
        tag = cache.frontmatter["mathLink-blocks"][mathCache.id] ?? '';
    }
    return tag;
}

export function insertAfter(referenceNode: HTMLElement, newNode: HTMLElement) {
    // https://stackoverflow.com/a/4793630/13613783
    referenceNode.parentNode?.insertBefore(newNode, referenceNode.nextSibling);
}

export function nodeText(node: SyntaxNodeRef, state: EditorState): string {
    return state.sliceDoc(node.from, node.to);
}

const ROMAN = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
    "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
    "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

export function toRomanUpper(num: number): string {
    // https://stackoverflow.com/a/9083076/13613783
    let digits = String(num).split("");
    let roman = "";
    let i = 3;
    while (i--) {
        // @ts-ignore
        roman = (ROMAN[+digits.pop() + (i * 10)] ?? "") + roman;
    }
    return Array(+digits.join("") + 1).join("M") + roman;
}

export function toRomanLower(num: number): string{
    return toRomanUpper(num).toLowerCase();
}

export const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function toAlphUpper(num: number): string {
    return (num - 1).toString(26).split("").map(str => ALPH[parseInt(str, 26)]).join("");
}

export function toAlphLower(num: number): string {
    return toAlphUpper(num).toLowerCase();
}

export const CONVERTER = {
    "arabic": String, 
    "alph": toAlphLower, 
    "Alph": toAlphUpper, 
    "roman": toRomanLower, 
    "Roman": toRomanUpper,
}
