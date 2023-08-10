/** Currently unused (help wanted!) */

import { MarkdownView, App } from 'obsidian';
import { RangeSetBuilder, EditorState, RangeValue } from '@codemirror/state';
import { Decoration, EditorView, ViewUpdate, DecorationSet, PluginValue, ViewPlugin } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNodeRef } from '@lezer/common';

import MathBooster from './main';
import { nodeTextQuoteSymbolTrimmed } from './utils';
import { CALLOUT, BLOCKQUOTE } from './math_callout_metadata_hider';


type CalloutInfo = { titleLine: CalloutTitleLine, contentLines: CalloutContentLine[], level: number };

abstract class CalloutLine {
    text: string | undefined;

    constructor(public node: SyntaxNodeRef, state: EditorState, public level: number) {
        this.text = nodeTextQuoteSymbolTrimmed(node, state, level);
    }
}

class CalloutTitleLine extends CalloutLine {
    data: { type: string, metadata: string, title: string };

    constructor(node: SyntaxNodeRef, state: EditorState, level: number) {
        super(node, state, level);
        this.setData();
    }

    setData() {
        const match = this.text?.match(/\[!([^\|]+)(\|(.+))?\] *(\S.*)/);
        if (match) {
            this.data = {
                type: match[1],
                metadata: match[3],
                title: match[4]
            }
        }
    }
}

class CalloutContentLine extends CalloutLine { }


export function buildMathCalloutWrapperPlugin(app: App, plugin: MathBooster, markdownView: MarkdownView) {
    return ViewPlugin.fromClass(
        class implements PluginValue {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.impl(view);
            }
            update(update: ViewUpdate) {
                if (true || update.docChanged || update.viewportChanged) {
                    this.impl(update.view);
                }
            }
            impl(view: EditorView) {
                const lines = this.getCalloutLines(view);
                const callouts = this.processCalloutLines(lines);

                let builder = new RangeSetBuilder<Decoration>();

                for (let callout of callouts) {

                    // // div.callout-title-inner
                    // builder.add(
                    //     callout.titleLine.node.from,
                    //     callout.titleLine.node.to,
                    //     Decoration.mark({
                    //         // tagName: "div", 
                    //         class: "callout-title-inner"
                    //     })
                    // )
                    // // div.callout-title
                    // builder.add(
                    //     callout.titleLine.node.from,
                    //     callout.titleLine.node.to,
                    //     Decoration.mark({
                    //         // tagName: "div", 
                    //         class: "callout-title-inner"
                    //     })
                    // )
                    // div.callout-content
                    let to = callout.titleLine.node.to;
                    if (callout.contentLines.length) {
                        to = callout.contentLines[callout.contentLines.length - 1].node.to;
                        builder.add(
                            callout.contentLines[0].node.from,
                            callout.contentLines[callout.contentLines.length - 1].node.to,
                            Decoration.mark({
                                tagName: "div", 
                                class: "callout-content"
                            })
                        )    
                    }
                    // div.callout
                    builder.add(
                        callout.titleLine.node.from,
                        to,
                        Decoration.mark({
                            tagName: "div", 
                            class: "callout", 
                            attributes: {
                                "data-callout": callout.titleLine.data.type, 
                                "data-metadata": callout.titleLine.data.metadata,  
                            }
                        })
                    )
                }
                this.decorations = builder.finish();
            }
            
            processCalloutLines(lines: CalloutLine[]): CalloutInfo[] {
                let callout: CalloutInfo;
                let stack: CalloutInfo[] = [];
                let callouts: CalloutInfo[] = [];
                for (let line of lines) {
                    if (line instanceof CalloutTitleLine) {
                        callout = {titleLine: line, contentLines: [], level: line.level};
                        stack.push(callout);
                    } else if (stack.length && line instanceof CalloutContentLine) {
                        let callout = stack[stack.length - 1];
                        if (callout.level == line.level) {
                            callout.contentLines.push(line);
                        } else {
                            callouts.push(callout);
                            stack.pop();
                        }
                    }
                }
                if (stack.length) {
                    let callout = stack[stack.length - 1];
                    callouts.push(callout);
                    stack.pop();    
                }
                return callouts;
            }

            getCalloutLines(view: EditorView) {
                let lines: CalloutLine[] = [];
                let tree = syntaxTree(view.state);

                for (let { from, to } of view.visibleRanges) {
                    let levelStack: number[] = [];
                    tree.iterate({
                        from,
                        to,
                        enter(node) {
                            const match = node.name.match(CALLOUT);
                            if (match) {
                                levelStack.push(+match[1]);
                                lines.push(
                                    new CalloutTitleLine(node, view.state, levelStack[levelStack.length - 1])
                                );
                            }
                            else if (levelStack.length) {
                                if (node.name != BLOCKQUOTE(levelStack[levelStack.length - 1])) {
                                    levelStack.pop();
                                }
                                lines.push(
                                    new CalloutContentLine(node, view.state, levelStack[levelStack.length - 1])
                                );
                            }
                            return node.name == "Document";
                        }
                    })
                }
                return lines;
            }

        }, {
        decorations: instance => instance.decorations,
    });
}
