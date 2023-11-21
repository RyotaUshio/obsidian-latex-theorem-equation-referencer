import { EquationBlock } from "index/typings/markdown";
import { renderMath } from "obsidian";
import { MathContextSettings } from "settings/settings";
import { MutationObservingChild } from "utils/obsidian";
import { parseLatexComment } from "utils/parse";



export function replaceMathTag(displayMathEl: HTMLElement, equation: EquationBlock, settings: Required<MathContextSettings>) {
    if (equation.$manualTag) return; // respect a tag (\tag{...}) manually set by the user

    const taggedText = getMathTextWithTag(equation, settings.lineByLine);
    if (taggedText) {
        const mjxContainerEl = renderMath(taggedText, true);
        if (equation.$printName !== null) {
            displayMathEl.setAttribute('width', 'full');
            displayMathEl.style.cssText = mjxContainerEl.style.cssText;
        }
        displayMathEl.replaceChildren(...mjxContainerEl.childNodes);        
    }
}

export function getMathTextWithTag(equation: EquationBlock, lineByLine?: boolean): string | undefined {
    if (equation.$printName !== null) {
        const tagResult = equation.$printName.match(/^\((.*)\)$/);
        if (tagResult) {
            const tagContent = tagResult[1];
            return insertTagInMathText(equation.$mathText, tagContent, lineByLine);
        }
    }
    return equation.$mathText;
}

export function insertTagInMathText(text: string, tagContent: string, lineByLine?: boolean): string {
    if (lineByLine) {
        const alignResult = text.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
        if (alignResult) {
            // remove comments
            let alignContent = alignResult[1]
                .split('\n')
                .map(line => parseLatexComment(line).nonComment)
                .join('\n');
            // add tags
            let index = 1;
            alignContent = alignContent
                .split("\\\\")
                .map(alignLine => (!alignLine.trim() || alignLine.contains("\\nonumber"))
                    ? alignLine
                    : (alignLine + `\\tag{${tagContent}-${index++}}`)
                ).join("\\\\");
            return "\\begin{align}" + alignContent + "\\end{align}";
        }
    }
    return text + `\\tag{${tagContent}}`;
}
