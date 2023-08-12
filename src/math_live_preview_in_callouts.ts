import { finishRenderMath, renderMath } from "obsidian";
import { Extension, Transaction, StateField, RangeSetBuilder, EditorState, RangeValue, RangeSet } from '@codemirror/state';
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

    ignoreEvent(event: Event): boolean {
        // the rendered MathJax won't respond to clicks without this definition
        return false;
    }
}

class MathInfo extends RangeValue {
    mathEl: HTMLElement;

    constructor(public mathText: string, public display: boolean) {
        super();
        this.render()
    }

    async render() {
        this.mathEl = renderMath(this.mathText, this.display);
        await finishRenderMath();
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

type MathInfoSet = RangeSet<MathInfo>;

function buildMathInfoSet(state: EditorState): MathInfoSet {
    let tree = syntaxTree(state);
    let builder = new RangeSetBuilder<MathInfo>();

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
                        new MathInfo(mathText, display as boolean)
                    );
                    insideMath = false;
                    display = undefined;
                } else {
                    let match = node.name.match(BLOCKQUOTE);
                    if (match) {
                        let quoteLevel = +match[1];
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

export type MathPreviewInfo = {
    mathInfoSet: MathInfoSet;
    isInCalloutsOrQuotes: boolean;
    hasOverlappingMath: boolean;
}

export const MathPreviewInfoField = StateField.define<MathPreviewInfo>({
    create(state: EditorState): MathPreviewInfo {
        return {
            mathInfoSet: RangeSet.empty,
            isInCalloutsOrQuotes: false,
            hasOverlappingMath: false,
        }
    },

    update(prev: MathPreviewInfo, transaction: Transaction): MathPreviewInfo {
        // set isInCalloutsOrQuotes
        let isInCalloutsOrQuotes = isInBlockquoteOrCallout(transaction.state);
        // set hasOverlappingMath
        const range = transaction.state.selection.main;
        let cursor = prev.mathInfoSet.iter();
        let hasOverlappingMath = false;
        while (cursor.value) {
            hasOverlappingMath = hasOverlappingMath || (range.from <= cursor.to && cursor.from <= range.to);
            cursor.next();
        }
        // set mathInfoSet
        let mathInfoSet: MathInfoSet;
        if (isInCalloutsOrQuotes) {
            if (
                !prev.isInCalloutsOrQuotes // If newly entered inside a callout or quote
                || (prev.hasOverlappingMath && !hasOverlappingMath) // or just got out of math
            ) {
                // rebuild all math info, including rendered MathJax (this should be done more efficiently in the near future)
                mathInfoSet = buildMathInfoSet(transaction.state);
            } else if (transaction.docChanged) {
                mathInfoSet = this.mathInfoSet.map(transaction.changes.desc);
            } else {
                mathInfoSet = prev.mathInfoSet;
            }
        } else {
            mathInfoSet = prev.mathInfoSet;
        }
        return { mathInfoSet, isInCalloutsOrQuotes, hasOverlappingMath };
    },

});


export const inlineMathPreviewView = ViewPlugin.fromClass(
    class implements PluginValue {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.view.state.field(MathPreviewInfoField).isInCalloutsOrQuotes) {
                this.buildDecorations(update.view);
            } else {
                this.decorations = Decoration.none;
            }
        }

        buildDecorations(view: EditorView) {
            let range = view.state.selection.main;
            let builder = new RangeSetBuilder<Decoration>();

            for (const { from, to } of view.visibleRanges) {
                view.state.field(MathPreviewInfoField).mathInfoSet.between(
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
    },
    { decorations: instance => instance.decorations }
);


export const displayMathPreviewView = StateField.define<DecorationSet>({
    create(state: EditorState): DecorationSet {
        return Decoration.none;
    },

    update(value: DecorationSet, transaction: Transaction): DecorationSet {
        if (transaction.state.field(MathPreviewInfoField).isInCalloutsOrQuotes) {
            let builder = new RangeSetBuilder<Decoration>();
            const range = transaction.state.selection.main;

            transaction.state.field(MathPreviewInfoField).mathInfoSet.between(
                0,
                transaction.state.doc.length,
                (from, to, value) => {
                    if (value.display) {
                        if (to < range.from || from > range.to) {
                            builder.add(from, to, value.toDecoration("replace"));
                        } else {
                            builder.add(to + 1, to + 1, value.toDecoration("insert"));
                        }
                    }
                }
            );
            return builder.finish();
        }
        return Decoration.none;
    },

    provide(field: StateField<DecorationSet>): Extension {
        return EditorView.decorations.from(field);
    },
});


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
