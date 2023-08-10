import { finishRenderMath, renderMath } from "obsidian";
import { Extension, Transaction, StateField, RangeSetBuilder, EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from '@codemirror/language';

import { nodeText } from 'utils';


const DISPLAY_MATH_BEGIN = "formatting_formatting-math_formatting-math-begin_keyword_math_math-block";
const INLINE_MATH_BEGIN = "formatting_formatting-math_formatting-math-begin_keyword_math";
const MATH_END = "formatting_formatting-math_formatting-math-end_keyword_math_math-";
const BLOCKQUOTE = /HyperMD-quote_HyperMD-quote-([1-9][0-9]*)/;


class MathPreviewWidget extends WidgetType {
    constructor(public mathEl: HTMLElement) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return this.mathEl;
    }
}


type MathInfo = { mathText: string, display: boolean, from: number, to: number };

export const blockquoteMathPreviewPlugin = StateField.define<DecorationSet>({
    create(state: EditorState): DecorationSet {
        return Decoration.none;
    },
    update(value: DecorationSet, transaction: Transaction): DecorationSet {
        if (isInBlockquoteOrCallout(transaction.startState)) {
            return impl(transaction.state);
        }
        return Decoration.none;
    },
    provide(field: StateField<DecorationSet>): Extension {
        return EditorView.decorations.from(field);
    },
});

function impl(state: EditorState): DecorationSet {
    let builder = new RangeSetBuilder<Decoration>();
    let maths = getMathInfos(state);

    for (let math of maths) {
        let range = state.selection.ranges[0];

        let mathEl = renderMath(math.mathText, math.display);
        finishRenderMath();

        if (math.to < range.from || math.from > range.to) {
            builder.add(
                math.from,
                math.to,
                Decoration.replace({
                    widget: new MathPreviewWidget(mathEl),
                })
            );
        } else if (math.display) {
            builder.add(
                math.to + 1,
                math.to + 1,
                Decoration.widget({
                    widget: new MathPreviewWidget(mathEl),
                    block: true,
                })
            );
        }
    }
    return builder.finish();
}

function getMathInfos(state: EditorState): MathInfo[] {
    let tree = syntaxTree(state);

    let mathInfos: MathInfo[] = [];
    let from: number;
    let to: number;
    let mathText: string;
    let insideMath = false;
    let display: boolean | undefined;
    let quoteContentStart = 0;

    tree.iterate({
        enter(node) {
            if (node.from < quoteContentStart) {
                return;
            }
            if (insideMath) {
                if (node.name == MATH_END) {
                    mathInfos.push({ 
                        mathText: mathText, 
                        display: display as boolean, 
                        from: from, 
                        to: node.to,
                    });
                    insideMath = false;
                    display = undefined;
                } else {
                    let match = node.name.match(BLOCKQUOTE);
                    if (match) {
                        let quoteLevel = Number(match[1]);
                        if (node.node.firstChild) {
                            quoteContentStart = node.node.firstChild.to;
                            let quoteSymbolPattern = new RegExp(`((>\\s*){${quoteLevel}})(.*)`);
                            let quoteSymbolMatch = nodeText(node.node.firstChild, state).match(quoteSymbolPattern);
                            if (quoteSymbolMatch) {
                                mathText += quoteSymbolMatch.slice(-1)[0];
                            }
                        }
                    } else {
                        if (node.name.contains("math")) {
                            mathText += nodeText(node, state);
                        }
                    }
                }
            } else {
                if (node.name == DISPLAY_MATH_BEGIN) {
                    insideMath = true;
                    display = true;
                    from = node.from;
                    mathText = "";
                } else if (node.name == INLINE_MATH_BEGIN) {
                    insideMath = true;
                    display = false;
                    from = node.from;
                    mathText = "";
                }
            }
        }
    });

    return mathInfos;
}

function isInBlockquoteOrCallout(state: EditorState): boolean {
    let cursor = state.selection.ranges[0].head;
    let tree = syntaxTree(state);
    let foundQuote = false;
    tree.iterate({
        enter(node) {
            let match = node.name.match(BLOCKQUOTE);
            if (match) {
                if (node.from <= cursor && cursor <= node.to) {
                    foundQuote = true;
                    return false;
                }
            }
        }
    });
    return foundQuote;
}
