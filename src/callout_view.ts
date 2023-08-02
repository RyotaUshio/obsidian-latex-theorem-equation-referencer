import { EditorState } from '@codemirror/state';
import { EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Editor, finishRenderMath, renderMath } from "obsidian";
import { insertAfter } from "utils";



class MathPreviewWidget extends WidgetType {
    constructor(public mathText: string) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        let displayMathEl = renderMath(this.mathText, true);
        finishRenderMath();
        return displayMathEl;
    }
}


export const calloutViewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
        constructor(view: EditorView) {
            this.impl(view);
        }

        update(update: ViewUpdate) {
            let previewElements = update.view.dom.querySelectorAll<HTMLElement>(".math-preview");
            if (previewElements) {
                previewElements.forEach((el) => el.remove());
            }
            if (update.docChanged) {
                this.impl(update.view);
            }
        }

        impl(view: EditorView) {
            let cmMathElements = view.dom.querySelectorAll<HTMLElement>(".HyperMD-quote > .cm-math");
            if (cmMathElements) {
                cmMathElements.forEach((el) => console.log(el));
                let cmMathArray = Array.from(cmMathElements);
                this.toChunk(cmMathArray, view);
            }
        }

        toChunk(cmMathArray: Array<HTMLElement>, view: EditorView) {
            if (cmMathArray.length) {
                let begin = cmMathArray.findIndex((cmMathEl) =>
                    cmMathEl.classList.contains("cm-formatting-math-begin")
                    && cmMathEl.textContent == "$$"
                );
                let end = cmMathArray.findIndex((cmMathEl) =>
                    cmMathEl.classList.contains("cm-formatting-math-end")
                    && cmMathEl.textContent == "$$"
                );
                if (begin >= 0 && end >= 0) {
                    let equationElements = cmMathArray
                        .slice(begin + 1, end)
                        .filter((cmMathEl) => cmMathEl.classList.length > 1);
                    let mathText = equationElements.map((cmMathEl) => cmMathEl.textContent).join(" ");

                    let displayMathEl = renderMath(mathText, true);
                    finishRenderMath();

                    let cmLineEl = cmMathArray[end].parentElement;
                    if (cmLineEl) {
                        let range = view.state.selection.ranges[0];
                        let beginPos = view.posAtDOM(cmMathArray[begin]);
                        let endPos = view.posAtDOM(cmMathArray[end]);

                        if (endPos < range.from || beginPos > range.to) {
                            cmLineEl.replaceChildren(...cmMathArray.slice(1, begin), displayMathEl, ...cmMathArray.slice(end + 1))
                        } else {
                            displayMathEl.classList.add("math-preview");
                            insertAfter(cmLineEl, displayMathEl);
                        }
                    }

                    this.toChunk(cmMathArray.slice(end + 1), view);
                }
            }
        }
    }
);