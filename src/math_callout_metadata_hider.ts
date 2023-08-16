import { App, MarkdownView, Plugin } from 'obsidian';
import { RangeSetBuilder, RangeSet, RangeValue, EditorState } from '@codemirror/state';
import { syntaxTree } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"

import { nodeText, MATH_CALLOUT_PATTERN, matchMathCallout, printNode, nodeTextQuoteSymbolTrimmed } from './utils';


export const MATH_CALLOUT_PATTERN_GLOBAL = new RegExp(MATH_CALLOUT_PATTERN.source, "g");

export const CALLOUT = /HyperMD-callout_HyperMD-quote_HyperMD-quote-([1-9][0-9]*)/;
const CALLOUT_PRE_TITLE = (level: number) => new RegExp(`formatting_formatting-quote_formatting-quote-${level}_hmd-callout_quote_quote-${level}`);
export const BLOCKQUOTE = (level: number) => `HyperMD-quote_HyperMD-quote-${level}`


class DummyRangeValue extends RangeValue { } // only for creating atomic ranges, so don't care the actual value


export const mathCalloutMetadataHiderPlulgin = ViewPlugin.fromClass(
    class implements PluginValue {
        decorations: DecorationSet;
        atomicRanges: RangeSet<DummyRangeValue>;

        constructor(view: EditorView) {
            this.impl(view);
        }
        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.impl(update.view);
            }
        }
        impl(view: EditorView) {
            const decorationBuilder = new RangeSetBuilder<Decoration>();
            const atomicRangeBuilder = new RangeSetBuilder<DummyRangeValue>();
            const tree = syntaxTree(view.state);

            for (const { from, to } of view.visibleRanges) {
                tree.iterate({
                    from,
                    to,
                    enter(node) {
                        const match = node.name.match(CALLOUT);
                        if (match) {
                            const level = +match[1];
                            const calloutPreTitleNode = node.node.firstChild;
                            if (calloutPreTitleNode?.name.match(CALLOUT_PRE_TITLE(level))) {
                                const text = nodeText(calloutPreTitleNode, view.state);
                                if (matchMathCallout(text)) {
                                    decorationBuilder.add(
                                        calloutPreTitleNode.from + 2,
                                        calloutPreTitleNode.to,
                                        Decoration.replace({})
                                    );
                                    atomicRangeBuilder.add(
                                        calloutPreTitleNode.from + 2,
                                        node.to,
                                        new DummyRangeValue()
                                    );
                                }
                            }
                        }
                    }
                })
            }
            this.decorations = decorationBuilder.finish();
            this.atomicRanges = atomicRangeBuilder.finish();
        }

    }, {
    decorations: instance => instance.decorations,
    provide: plugin => EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.atomicRanges ?? Decoration.none
    })
});
