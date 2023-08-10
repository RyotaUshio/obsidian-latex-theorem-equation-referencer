import { App, MarkdownView } from "obsidian";
import { RangeSetBuilder, RangeSet, RangeValue } from '@codemirror/state';
import { syntaxTree } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"

import MathBooster from "./main";
import { nodeText, MATH_CALLOUT_PATTERN, matchMathCallout } from './utils';


export const MATH_CALLOUT_PATTERN_GLOBAL = new RegExp(MATH_CALLOUT_PATTERN.source, "g");

const CALLOUT = /HyperMD-callout_HyperMD-quote_HyperMD-quote-([1-9][0-9]*)/;
const CALLOUT_PRE_TITLE = (level: number) => new RegExp(`formatting_formatting-quote_formatting-quote-${level}_hmd-callout_quote_quote-${level}`);


class MathCalloutTitleHiderWidget extends WidgetType {
    constructor(public title: string) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return createSpan({text: this.title});
    }
}


class DummyRangeValue extends RangeValue {}


export function buildMathCalloutHiderPlulgin(app: App, plugin: MathBooster, markdownView: MarkdownView) {
    return ViewPlugin.fromClass(
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
                let decorationBuilder = new RangeSetBuilder<Decoration>();
                let atomicRangeBuilder = new RangeSetBuilder<DummyRangeValue>();
                let tree = syntaxTree(view.state);

                for (let {from, to} of view.visibleRanges) {
                    tree.iterate({
                        from, 
                        to,
                        enter(node) {
                            console.log(
                                `${node.from}-${node.to}: "${view.state.sliceDoc(node.from, node.to)}" (${node.name})`
                            );
                            const match = node.name.match(CALLOUT);
                            if (match) {
                                const level = +match[1];
                                let calloutPreTitleNode = node.node.firstChild;
                                if (calloutPreTitleNode?.name.match(CALLOUT_PRE_TITLE(level))) {
                                    let text = nodeText(calloutPreTitleNode, view.state);
                                    if (matchMathCallout(text)) {
                                        console.log(view.domAtPos(calloutPreTitleNode.to));
                                        decorationBuilder.add(
                                            calloutPreTitleNode.from + 2, 
                                            calloutPreTitleNode.to, 
                                            Decoration.replace({})
                                            // Decoration.replace({
                                            //     widget: new MathCalloutTitleHiderWidget(
                                            //         view.state.sliceDoc(
                                            //             calloutBeforeTitle.to, node.to
                                            //         )
                                            //     )
                                            // })
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
}