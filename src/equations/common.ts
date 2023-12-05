import { EquationBlock } from "index/typings/markdown";
import { finishRenderMath, renderMath } from "obsidian";
import { MathContextSettings } from "settings/settings";
import { parseLatexComment } from "utils/parse";



export function replaceMathTag(displayMathEl: HTMLElement, equation: EquationBlock, settings: Required<MathContextSettings>) {
    if (equation.$manualTag) return; // respect a tag (\tag{...}) manually set by the user

    const taggedText = getMathTextWithTag(equation, settings.lineByLine);
    if (taggedText) {
        const mjxContainerEl = renderMath(taggedText, true);
        if (equation.$printName !== null) {
            displayMathEl.setAttribute('width', 'full');
            displayMathEl.style.cssText = mjxContainerEl.style.cssText;
        } else {
            displayMathEl.removeAttribute('width');
            displayMathEl.removeAttribute('style');
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
    if (!lineByLine) return text + `\\tag{${tagContent}}`;

    const alignResult = text.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
    if (!alignResult) return text + `\\tag{${tagContent}}`;

    const envStack: string[] = [];

    // remove comments
    let alignContent = alignResult[1]
        .split('\n')
        .map(line => parseLatexComment(line).nonComment)
        .join('\n');
    // add tags
    let index = 1;
    alignContent = alignContent
        .split("\\\\")
        .map((alignLine) => {
            const pattern = /\\(?<which>begin|end)\{(?<env>.*?)\}/g;
            let result;
            while (result = pattern.exec(alignLine)) {
                const { which, env } = result.groups!;
                if (which === 'begin') envStack.push(env);
                else if (envStack.last() === env) envStack.pop();
            }
            if (envStack.length || !alignLine.trim() || alignLine.contains("\\nonumber")) return alignLine;
            return alignLine + `\\tag{${tagContent}-${index++}}`;
        }).join("\\\\");

    if (index <= 2) return text + `\\tag{${tagContent}}`;

    return "\\begin{align}" + alignContent + "\\end{align}";
}
