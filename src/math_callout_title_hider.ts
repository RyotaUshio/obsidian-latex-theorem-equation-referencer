import { mathCalloutTitlePlulgin } from 'math_callouts_view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView, MatchDecorator, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"
import { MATH_CALLOUT_PATTERN, formatTitleWithoutSubtitle, matchMathCallout, readMathCalloutMetadata, readMathCalloutSettingsAndTitle } from "autoIndex"
import MathPlugin from "main";
import { SmartCalloutModal } from "modals";
import { App, Editor, MarkdownView, TFile } from "obsidian";
import { MathSettings } from "settings";
import { formatTitle, overwriteMathCalloutMetadata, resolveSettings } from "smart_callouts";
import { nodeText, renderTextWithMath } from "utils";


export const MATH_CALLOUT_PATTERN_GLOBAL = new RegExp(MATH_CALLOUT_PATTERN.source, "g");

const CALLOUT = "HyperMD-callout_HyperMD-quote_HyperMD-quote-1";
const CALLOUT_BEFORE_TITLE = "formatting_formatting-quote_formatting-quote-1_hmd-callout_quote_quote-1";

class MathCalloutTitleHiderWidget extends WidgetType {
    constructor(public title: string) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return createSpan({text: this.title});
    }
}


export function buildMathCalloutPlulgin(app: App, plugin: MathPlugin, currentFile: TFile) {
    return ViewPlugin.fromClass(
        class implements PluginValue {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.impl(view);
            }
            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.impl(update.view);
                }
            }
            impl(view: EditorView) {
                let builder = new RangeSetBuilder<Decoration>();
                let tree = syntaxTree(view.state);

                for (let {from, to} of view.visibleRanges) {
                    tree.iterate({
                        from, 
                        to,
                        enter(node) {
                            console.log(
                                `${node.from}-${node.to}: "${view.state.sliceDoc(node.from, node.to)}" (${node.name})`
                            );
                            if (node.name.match(CALLOUT)) {
                                let calloutBeforeTitle = node.node.firstChild;
                                if (calloutBeforeTitle?.name.match(CALLOUT_BEFORE_TITLE)) {
                                    let text = nodeText(calloutBeforeTitle, view.state);
                                    if (matchMathCallout(text)) {
                                        console.log(view.domAtPos(calloutBeforeTitle.to));
                                        builder.add(
                                            calloutBeforeTitle.to - 1, 
                                            node.to, 
                                            Decoration.replace({
                                                widget: new MathCalloutTitleHiderWidget(
                                                    view.state.sliceDoc(
                                                        calloutBeforeTitle.to, node.to
                                                    )
                                                )
                                            })
                                        );
                                    }
                                }
                            }
                        }
                    })
                }
                this.decorations = builder.finish();
            }
            
        }, {
        decorations: instance => instance.decorations,
        provide: plugin => EditorView.atomicRanges.of(view => {
            return view.plugin(plugin)?.decorations || Decoration.none
        })
    });
}