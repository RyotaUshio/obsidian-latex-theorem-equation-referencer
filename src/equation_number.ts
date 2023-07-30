import { PluginValue, ViewUpdate } from '@codemirror/view';

import { SyntaxNodeRef } from '@lezer/common';
import { foldInside, syntaxTree } from '@codemirror/language';
import { EditorState, StateEffect, StateField, Transaction, RangeSetBuilder, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';

import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, TFile, Menu, setIcon, MetadataCache } from "obsidian";
import { getMathTag } from 'utils';
import { StringStream } from 'codemirror';

export class DisplayMathRenderChild extends MarkdownRenderChild {
    constructor(containerEl: HTMLElement, public tag: string) {
        super(containerEl);
    }

    onload() {
        let tagEl = getTagEl(this.containerEl);
        if (tagEl) {
            replaceMathTag(tagEl, this.tag);
        }
    }
}



export function buildEquationNumberPlugin<V extends PluginValue>(app: App, path: string): ViewPlugin<V> {

    return ViewPlugin.fromClass(class implements PluginValue {
        constructor(public view: EditorView) {
            this.impl(this.view);
        }

        update(update: ViewUpdate) {
            this.impl(update.view);
        }

        impl(view: EditorView, tagAll?: string) {
            let displayMathElements = view.dom.querySelectorAll<HTMLElement>('mjx-container.MathJax mjx-math[display="true"]');
            let tag = tagAll ?? "";
            let cache = app.metadataCache.getCache(path);
            if (cache) {
                if (displayMathElements) {
                    displayMathElements.forEach((displayMathEl) => {
                        if (tagAll === undefined) {
                            let pos = view.posAtDOM(displayMathEl);
                            let line = view.state.doc.lineAt(pos);
                            let lineNumber = line.number - 1; // CodeMirror6 uses 1-origin line numbers
                            // @ts-ignore
                            tag = getMathTag(cache, lineNumber);
                        }
                        let tagEl = getTagEl(displayMathEl);
                        if (tagEl && isAutoNumbered(tagEl)) {
                            replaceMathTag(tagEl, tag);
                        }
                    });
                }
            }
        }

        destroy() {
            this.impl(this.view, "(@)");
        }
    });
}



function getTagEl(displayMathEl: HTMLElement): HTMLElement | null {
    // displayMathEl: HTMLElement selected by 'mjx-container.MathJax mjx-math[display="true"]'
    return displayMathEl.querySelector<HTMLElement>("mjx-mtext.mjx-n");
}


function replaceMathTag(tagEl: HTMLElement, tag: string): void {
    // replace the tag number as (@) => ([tag])
    let numberEl = renderMath("\\text{" + tag + "}", false);
    finishRenderMath();

    let contentEl = numberEl.querySelector("mjx-mtext.mjx-n");
    if (contentEl) {
        contentEl.classList.add("auto-number");
        tagEl.replaceWith(contentEl);
    }
}


function isAutoNumbered(tagEl: HTMLElement): boolean {
    if (tagEl) {
        if (tagEl.classList.contains("auto-number")) {
            return true;
        }

        let tagCharElements = tagEl.children;
        return Boolean(
            tagCharElements.item(0)?.matches("mjx-c.mjx-c28")
            && tagCharElements.item(1)?.matches("mjx-c.mjx-c40")
            && tagCharElements.item(2)?.matches("mjx-c.mjx-c29")
        );
    }
    return false;
}
