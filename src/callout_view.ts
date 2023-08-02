import { toInt } from './../../obsidian-zotero-integration/src/bbt/queue';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { SyntaxNodeRef } from '@lezer/common';
import { Editor, finishRenderMath, renderMath } from "obsidian";
import { insertAfter } from "utils";


const DISPLAY_MATH_BEGIN = "formatting_formatting-math_formatting-math-begin_keyword_math_math-block";
const INLINE_MATH_BEGIN = "formatting_formatting-math_formatting-math-begin_keyword_math";
const MATH_END = "formatting_formatting-math_formatting-math-end_keyword_math_math-";
const BLOCKQUOTE = /HyperMD-quote_HyperMD-quote-([1-9][0-9]*)/;
const quoteSymbol = (level: number) => `formatting_formatting-quote_formatting-quote-${level}_quote_quote-${level}`;


class MathPreviewWidget extends WidgetType {
    constructor(public mathEl: HTMLElement) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return this.mathEl;
    }
}


// with decoration

type MathNodeStack = { nodes: Array<SyntaxNodeRef>, display: boolean };

class BlockquoteMathPreviewPlugin implements PluginValue {

    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.impl(view);
    }

    async update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            await this.impl(update.view);
        }
    }

    async impl(view: EditorView) {
        let builder = new RangeSetBuilder<Decoration>();
        let maths = this.getMathInfo(view);
        for (let math of maths) {
            let range = view.state.selection.ranges[0];

            if (math.to <= range.from || math.from >= range.to) {
                let mathEl = renderMath(math.mathText, math.display);
                await finishRenderMath();
                builder.add(
                    math.from,
                    math.to,
                    Decoration.replace({
                        widget: new MathPreviewWidget(mathEl),
                    })
                );
            }
        }
        this.decorations = builder.finish();
    }

    getMathInfo(view: EditorView): { mathText: string, display: boolean, from: number, to: number }[] {
        return this.getMathNodeStacks(view).map(
            mathNodeStack => {
                return {
                    mathText: mathNodeStack.nodes
                        .slice(1, -1) // remove dollar signs
                        .map(node => view.state.sliceDoc(node.from, node.to))
                        .join(""),
                    display: mathNodeStack.display,
                    from: mathNodeStack.nodes[0].from,
                    to: mathNodeStack.nodes[mathNodeStack.nodes.length - 1].to,
                }
            }
        );
    }

    getMathNodeStacks(view: EditorView): MathNodeStack[] {
        let builder = new RangeSetBuilder<Decoration>();
        let tree = syntaxTree(view.state);

        let mathNodeStacks: MathNodeStack[] = [];
        let mathNodes: SyntaxNodeRef[] = [];
        let insideMath = false;
        let display: boolean | undefined;
        let quoteContentStart = 0;

        for (let { from, to } of view.visibleRanges) {
            tree.iterate({
                from,
                to,
                enter(node) {
                    if (node.from < quoteContentStart) {
                        return;
                    }

                    if (insideMath) {
                        if (node.name == MATH_END) {
                            mathNodes.push(node.node);
                            mathNodeStacks.push(
                                { nodes: mathNodes, display: display as boolean }
                            );
                            mathNodes = [];
                            insideMath = false;
                            display = undefined;
                        } else {
                            let match = node.name.match(BLOCKQUOTE);
                            if (match) {
                                if (node.node.firstChild) {
                                    quoteContentStart = node.node.firstChild.to;
                                }
                            } else {
                                if (node.name.contains("math")) {
                                    mathNodes.push(node.node);
                                }
                            }
                        }
                    } else {
                        if (node.name == DISPLAY_MATH_BEGIN) {
                            insideMath = true;
                            display = true;
                            mathNodes.push(node.node);
                        } else if (node.name == INLINE_MATH_BEGIN) {
                            insideMath = true;
                            display = false;
                            mathNodes.push(node.node);
                        }
                    }
                }
            });
        }
        return mathNodeStacks;
    }
}


const pluginSpec: PluginSpec<BlockquoteMathPreviewPlugin> = {
    decorations: (value: BlockquoteMathPreviewPlugin) => value.decorations,
};

export const blockquoteMathPreviewPlugin = ViewPlugin.fromClass(
    BlockquoteMathPreviewPlugin,
    pluginSpec
);
