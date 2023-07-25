// Generic utility functions handing files.

import { App, TFile, getLinkpath, LinkCache, MarkdownView, renderMath, finishRenderMath, TAbstractFile, TFolder } from 'obsidian';


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


export function isEqualToOrChildOf(fileOrFolder: TAbstractFile, folder: TFolder): boolean {
    if (folder.isRoot()) {
        return true;
    }
    if ((fileOrFolder instanceof TFolder) && (fileOrFolder == folder)) {
        return true;
    }
    let ancestor = fileOrFolder.parent;
    while (true) {
        if (ancestor == folder) {
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
