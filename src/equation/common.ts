import { renderMath } from "obsidian";
import { MathContextSettings } from "settings/settings";
import { parseLatexComment } from "utils/parse";


export function getMathTextWithTag(text: string, tag: string | null, lineByLine?: boolean): string | undefined {
    if (tag !== null) {
        const tagResult = tag.match(/^\((.*)\)$/);
        if (tagResult) {
            const tagContent = tagResult[1];
            return insertTagInMathText(text, tagContent, lineByLine);
        }
    }
    return text;
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


export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string | null, settings: Required<MathContextSettings>) {
    const tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }
    const taggedText = getMathTextWithTag(text, tag, settings.lineByLine);
    if (taggedText) {
        const mjxContainerEl = renderMath(taggedText, true);
        displayMathEl.replaceChildren(...mjxContainerEl.childNodes);
    }
}
