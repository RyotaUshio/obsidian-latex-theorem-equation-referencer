import { Component, MarkdownRenderer, renderMath } from "obsidian";

export function renderTextWithMath(source: string): (HTMLElement | string)[] {
    // Obsidian API's renderMath only can render math itself, but not a text with math in it.
    // e.g., it can handle "\\sqrt{x}", but cannot "$\\sqrt{x}$ is a square root"

    const elements: (HTMLElement | string)[] = [];

    const mathPattern = /\$(.*?[^\s])\$/g;
    let result;
    let textFrom = 0;
    let textTo = 0;
    while ((result = mathPattern.exec(source)) !== null) {
        const mathString = result[1];
        textTo = result.index;
        if (textTo > textFrom) {
            elements.push(source.slice(textFrom, textTo));
        }
        textFrom = mathPattern.lastIndex;

        const mathJaxEl = renderMath(mathString, false);

        const mathSpan = createSpan({ cls: ["math", "math-inline", "is-loaded"] });
        mathSpan.replaceChildren(mathJaxEl);
        elements.push(mathSpan);
    }

    if (textFrom < source.length) {
        elements.push(source.slice(textFrom));
    }

    return elements;
}

/**
 * Easy-to-use version of MarkdownRenderer.renderMarkdown.
 * @param markdown 
 * @param sourcePath 
 * @param component - Typically you can just pass the plugin instance. 
 * @returns 
 */
export async function renderMarkdown(markdown: string, sourcePath: string, component: Component): Promise<NodeList | undefined> {
    const el = createSpan();
    await MarkdownRenderer.renderMarkdown(markdown, el, sourcePath, component);
    for (const child of el.children) {
        if (child.tagName == "P") {
            return child.childNodes;
        }
    }
}
