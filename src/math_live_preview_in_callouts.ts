import { ExtraButtonComponent, finishRenderMath, renderMath } from "obsidian";
import { Extension, Transaction, StateField, RangeSetBuilder, EditorState, RangeValue, RangeSet } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { syntaxTree } from '@codemirror/language';

import { isSourceMode, nodeText, nodeTextQuoteSymbolTrimmed } from './utils';
import { CALLOUT } from "./math_callout_metadata_hider";


const DISPLAY_MATH_BEGIN = "formatting_formatting-math_formatting-math-begin_keyword_math_math-block";
const INLINE_MATH_BEGIN = "formatting_formatting-math_formatting-math-begin_keyword_math";
const MATH_END = "formatting_formatting-math_formatting-math-end_keyword_math_math-";
const ERROR_MATH = "error_math";
const BLOCKQUOTE = /HyperMD-quote_HyperMD-quote-([1-9][0-9]*)/;


class MathPreviewWidget extends WidgetType {
    /** It is critical to pass a MathInfo object with a PRE-RENDERED MathJax element 
     * for decreasing the number of the expensive renderMath() calls */
    constructor(public info: MathInfo) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        this.info.mathEl.classList.add("math-booster-preview");
        if (this.info.display) {
            // <img class="cm-widgetBuffer" aria-hidden="true">
            const containerEl = createDiv({
                cls: ["HyperMD-quote", "HyperMD-quote-1", "HyperMD-quote-lazy", "cm-line"],
                attr: { style: "text-indent:-15px;padding-inline-start:19px;" }
            });
            containerEl.createEl("img", {
                cls: "cm-widgetBuffer",
                attr: { "aria-hidden": "true" }
            });
            const cmEmbedBlockEl = containerEl.createDiv({
                cls: ["math", "math-block", "cm-embed-block"],
                attr: {
                    contenteditable: false,
                }
            });
            cmEmbedBlockEl.appendChild(this.info.mathEl);
            const editButton = new ExtraButtonComponent(cmEmbedBlockEl)
                .setIcon("code-2")
                .setTooltip("Edit this block");
            editButton.extraSettingsEl.addEventListener("click", (ev: MouseEvent) => {
                ev.stopPropagation();
                view.dispatch({ selection: { anchor: this.info.from + 2, head: this.info.to - 2 } });
            })
            editButton.extraSettingsEl.classList.add("math-booster-preview-edit-button");
            return containerEl;
        }
        return this.info.mathEl;
    }

    ignoreEvent(event: Event): boolean {
        // the rendered MathJax won't respond to clicks without this definition
        return false;
    }
}

class MathInfo extends RangeValue {
    mathEl: HTMLElement;

    constructor(public mathText: string, public display: boolean, public from: number, public to: number, public insideCallout: boolean) {
        super();
        this.render()
    }

    async render() {
        this.mathEl = renderMath(this.mathText, this.display);
        await finishRenderMath();
    }

    toWidget(): MathPreviewWidget {
        return new MathPreviewWidget(this);
    }

    toDecoration(which: "replace" | "widget"): Decoration {
        return Decoration[which]({
            widget: this.toWidget(),
            block: this.display,
        })
    }
}

export type MathInfoSet = RangeSet<MathInfo>;

function buildMathInfoSet(state: EditorState): MathInfoSet {

    const tree = syntaxTree(state);
    const builder = new RangeSetBuilder<MathInfo>();

    let from: number = -1;
    let mathText: string;
    let insideMath = false;
    let display: boolean | undefined;
    let quoteContentStart = 0;
    let insideCallout = false;
    let lastCalloutPos: number;

    tree.iterate({
        enter(node) {
            if (node.node.parent?.name == "Document") {
                if (insideCallout) {
                    if (node.from == lastCalloutPos + 1 && node.name.match(BLOCKQUOTE)) {
                        lastCalloutPos = node.to;
                    } else {
                        insideCallout = false;
                    }
                }
                if (node.name.match(CALLOUT)) {
                    insideCallout = true;
                    lastCalloutPos = node.to;
                }
            }

            if (node.from < quoteContentStart) {
                return;
            }
            if (insideMath) {
                if (node.name == MATH_END) {
                    builder.add(
                        from,
                        node.to,
                        new MathInfo(mathText, display as boolean, from, node.to, insideCallout)
                    );
                    insideMath = false;
                    display = undefined;
                } else if (display && node.name == ERROR_MATH && nodeText(node, state) == "$") {
                    /** When inserting inline math at the top of "foo $x = 1$ bar",
                     * the text becomes "$$ foo $x = 1$ bar".
                     * This "$$" should be interpreted as INLINE_MATH_BEGIN + MATH_END, but 
                     * CodeMirror misundertands it as a single DISPLAY_MATH_BEGIN.
                     * To handle this exception, here I make use of the fact that 
                     * two "$"s are labeled as ERROR_MATH in this case.
                     */
                    builder.add(
                        from,
                        from + 2, // 2 = "$$".length
                        new MathInfo(mathText, false, from, from + 2, insideCallout)
                    );
                    insideMath = false;
                    display = undefined;
                } else {
                    const match = node.name.match(BLOCKQUOTE);
                    if (match) {
                        const quoteLevel = +match[1];
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
                /** collect mathInfo only inside callouts or blockquotes */
                const match = node.node.parent?.name.match(BLOCKQUOTE);
                if (match) {
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
        }
    });

    if (insideMath && display && from >= 0) {
        /** When inserting inline math at the top of "foo $x = 1$ bar",
         * the text becomes "$$ foo $x = 1$ bar".
         * This "$$" should be interpreted as INLINE_MATH_BEGIN + MATH_END, but 
         * CodeMirror misundertands it as a single DISPLAY_MATH_BEGIN.
         */
        builder.add(
            from,
            from + 2, // 2 = "$$".length
            new MathInfo("", false, from, from + 2, insideCallout)
        );
    }

    return builder.finish();
}

export type MathPreviewInfo = {
    mathInfoSet: MathInfoSet;
    isInCalloutsOrQuotes: boolean;
    hasOverlappingMath: boolean;
    hasOverlappingDisplayMath: boolean;
    rerendered: boolean;
}

export const mathPreviewInfoField = StateField.define<MathPreviewInfo>({
    create(state: EditorState): MathPreviewInfo {
        return {
            mathInfoSet: buildMathInfoSet(state), // RangeSet.empty,
            isInCalloutsOrQuotes: false,
            hasOverlappingMath: false,
            hasOverlappingDisplayMath: false,
            rerendered: false,
        }
    },

    update(prev: MathPreviewInfo, transaction: Transaction): MathPreviewInfo {
        // set isInCalloutsOrQuotes
        const isInCalloutsOrQuotes = isInBlockquoteOrCallout(transaction.state);
        // set hasOverlappingMath
        const range = transaction.state.selection.main;
        const cursor = prev.mathInfoSet.iter();
        let hasOverlappingMath = false;
        let hasOverlappingDisplayMath = false;
        while (cursor.value) {
            if (range.from <= cursor.to && cursor.from <= range.to) {
                hasOverlappingMath = true;
                if (cursor.value.display) {
                    hasOverlappingDisplayMath = true;
                }
                break;
            }
            cursor.next();
        }
        // set mathInfoSet & rerendered
        let mathInfoSet: MathInfoSet;
        let rerendered = false;
        if (!prev.mathInfoSet.size) {
            // rebuild all math info, including rendered MathJax (this should be done more efficiently in the near future)
            mathInfoSet = buildMathInfoSet(transaction.state);
            rerendered = true;
        } else if (isInCalloutsOrQuotes) {
            if (
                !prev.isInCalloutsOrQuotes // If newly entered inside a callout or quote
                || (prev.hasOverlappingMath && !hasOverlappingMath) // or just got out of math
            ) {
                // rebuild all math info, including rendered MathJax (this should be done more efficiently in the near future)
                mathInfoSet = buildMathInfoSet(transaction.state);
                rerendered = true;
            } else if (transaction.docChanged) {
                if (involvesDollar(transaction) || hasOverlappingDisplayMath) {
                    mathInfoSet = buildMathInfoSet(transaction.state);
                    rerendered = true;
                } else {
                    mathInfoSet = prev.mathInfoSet.map(transaction.changes.desc);
                }
            } else {
                mathInfoSet = prev.mathInfoSet;
            }
        } else {
            mathInfoSet = prev.mathInfoSet;
        }

        return { mathInfoSet, isInCalloutsOrQuotes, hasOverlappingMath, hasOverlappingDisplayMath, rerendered };
    },
});


export const mathPreviewViewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            this.buildDecorations(update.view);
        }

        buildDecorations(view: EditorView) {
            if (isSourceMode(view.state)) {
                this.decorations = Decoration.none;
                return;
            }

            const range = view.state.selection.main;
            const builder = new RangeSetBuilder<Decoration>();
            const field = view.state.field(mathPreviewInfoField);

            const mjxInQuote = Array.from(
                view.contentDOM.querySelectorAll<HTMLElement>(
                    '.HyperMD-quote.cm-line .math.math-block.cm-embed-block > mjx-container.MathJax:has( > mjx-math[display="true"]):not(.math-booster-preview)'
                )
            );
            const mjxPositions = mjxInQuote.map((el) => view.posAtDOM(el));

            for (const { from, to } of view.visibleRanges) {
                field.mathInfoSet.between(
                    from,
                    to,
                    (from, to, value) => {
                        if (to < range.from || from > range.to) {
                            if (!value.display) {
                                /**
                                 * Inline math that is not overlapping with the current selection or cursor
                                 */
                                builder.add(
                                    from,
                                    to,
                                    value.toDecoration("replace")
                                );
                            } else if (value.display && !value.insideCallout) {
                                /**
                                 * Display math inside blockquote (not callout) that is not overlapping with the current selection or cursor
                                 */
                                for (let i = 0; i < mjxInQuote.length; i++) {
                                    const mjx = mjxInQuote[i];
                                    const pos = mjxPositions[i];
                                    if (from - 1 <= pos && pos <= to) {
                                        value.mathEl.classList.add("math-booster-preview");
                                        mjx.replaceWith(value.mathEl);
                                    }
                                }
                            }
                        }
                    }
                );
            }
            this.decorations = builder.finish();
        }
    },
    { decorations: instance => instance.decorations }
);


export const mathPreviewStateField = StateField.define<DecorationSet>({
    create(state: EditorState): DecorationSet {
        return Decoration.none;
    },

    update(value: DecorationSet, transaction: Transaction): DecorationSet {
        if (isSourceMode(transaction.state)) {
            return Decoration.none;
        }

        const builder = new RangeSetBuilder<Decoration>();
        const range = transaction.state.selection.main;
        const field = transaction.state.field(mathPreviewInfoField);

        field.mathInfoSet.between(
            0,
            transaction.state.doc.length,
            (from, to, value) => {
                if (value.display) {
                    if (to < range.from || from > range.to) {
                        if (value.insideCallout && field.isInCalloutsOrQuotes) {
                            builder.add(from, to, value.toDecoration("replace"));
                        }
                    } else {
                        builder.add(to, to, value.toDecoration("widget"));
                    }
                }
            }
        );
        return builder.finish();
    },

    provide(field: StateField<DecorationSet>): Extension {
        return EditorView.decorations.from(field);
    },
});


function isInBlockquoteOrCallout(state: EditorState): boolean {
    const range = state.selection.main;
    const tree = syntaxTree(state);
    let foundQuote = false;
    tree.iterate({
        enter(node) {
            const match = node.name.match(BLOCKQUOTE);
            if (match) {
                if (node.from <= range.to && range.from <= node.to) {
                    foundQuote = true;
                    return false;
                }
            }
        }
    });
    return foundQuote;
}

function involvesDollar(transaction: Transaction): boolean {
    let ret = false;
    transaction.changes.iterChanges(
        (fromA, toA, fromB, toB, inserted) => {
            const textBefore = transaction.startState.sliceDoc(fromA, toA);
            const dollarEdited = textBefore.contains("$");
            const dollarInserted = inserted.toString().contains("$");
            ret = ret || dollarEdited || dollarInserted;
        }
    )
    return ret;
}
