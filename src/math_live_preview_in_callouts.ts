import { finishRenderMath, renderMath } from "obsidian";
import { Extension, Transaction, StateField, RangeSetBuilder, EditorState, RangeValue, RangeSet, SelectionRange } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { syntaxTree } from '@codemirror/language';

import { nodeText, nodeTextQuoteSymbolTrimmed } from 'utils';


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
        console.log(transaction.changes.desc);
        if (isInBlockquoteOrCallout(transaction.startState)) {
            console.log("called");
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
        let range = state.selection.main;

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
                            mathText += nodeTextQuoteSymbolTrimmed(node.node.firstChild, state, quoteLevel) ?? "";
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


export const blockquoteMathPreviewViewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
        decorations: DecorationSet;
        mathInfoSet: MathInfoSet;
        wasInCalloutsOrQuotes: boolean;
        hadOverlappingMath: boolean;

        constructor(view: EditorView) {
            this.mathInfoSet = buildMathInfoSet(view.state);
            this.buildDecorations(view);
            this.wasInCalloutsOrQuotes = isInBlockquoteOrCallout(view.state);
            this.hadOverlappingMath = this.hasOverlappingMath(view);
        }
        update(update: ViewUpdate) {
            const isInCalloutsOrQuotes = isInBlockquoteOrCallout(update.view.state);
            const hasOverlappingMath = this.hasOverlappingMath(update.view);
            if (isInCalloutsOrQuotes) {
                if (!this.wasInCalloutsOrQuotes) {
                    this.mathInfoSet = buildMathInfoSet(update.view.state);
                }
                if (update.docChanged) {
                    const changes = update.changes;
                    this.mathInfoSet = this.mathInfoSet.map(changes.desc)
                } else {
                    if (this.hadOverlappingMath && !hasOverlappingMath) {
                        this.mathInfoSet = buildMathInfoSet(update.view.state);
                    }                    
                }
                this.buildDecorations(update.view);
            }
            this.wasInCalloutsOrQuotes = isInCalloutsOrQuotes;
            this.hadOverlappingMath = hasOverlappingMath;
        }

        buildDecorations(view: EditorView) {
            let range = view.state.selection.main;
            let builder = new RangeSetBuilder<Decoration>();

            for (const { from, to } of view.visibleRanges) {
                let cursor = this.mathInfoSet.between(
                    from,
                    to,
                    (from, to, value) => {
                        if (!value.display && (to < range.from || from > range.to)) {
                            builder.add(
                                from,
                                to,
                                value.toDecoration("replace")
                            );
                        }
                    }
                );
            }
            this.decorations = builder.finish();
        }

        hasOverlappingMath(view: EditorView): boolean {
            const range = view.state.selection.main;
            let ret = false;
            this.mathInfoSet.between(
                view.viewport.from,
                view.viewport.to,
                (mathFrom, mathTo) => {
                    ret = ret || (range.from <= mathTo && mathFrom <= range.to);
                }
            )
            return ret;
        }
    },
    { decorations: instance => instance.decorations }
);



class MathInfo2 extends RangeValue {
    mathEl: HTMLElement;

    constructor(public mathText: string, public display: boolean) {
        super();
        this.render()
    }

    render() {
        this.mathEl = renderMath(this.mathText, this.display);
        finishRenderMath();
    }

    toWidget(): MathPreviewWidget {
        return new MathPreviewWidget(this.mathEl);
    }

    toDecoration(which: "replace" | "insert"): Decoration {
        return which == "replace"
            ? Decoration.replace({
                widget: this.toWidget()
            })
            : Decoration.widget({
                widget: this.toWidget(),
                block: true,
            });
    }
}

type MathInfoSet = RangeSet<MathInfo2>;

function buildMathInfoSet(state: EditorState): MathInfoSet {
    let tree = syntaxTree(state);
    let builder = new RangeSetBuilder<MathInfo2>();

    let from: number;
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
                    builder.add(
                        from,
                        node.to,
                        new MathInfo2(mathText, display as boolean)
                    );
                    insideMath = false;
                    display = undefined;
                } else {
                    let match = node.name.match(BLOCKQUOTE);
                    if (match) {
                        let quoteLevel = Number(match[1]);
                        if (node.node.firstChild) {
                            quoteContentStart = node.node.firstChild.to;
                            mathText += nodeTextQuoteSymbolTrimmed(node.node.firstChild, state, quoteLevel) ?? "";
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

    return builder.finish();
}
