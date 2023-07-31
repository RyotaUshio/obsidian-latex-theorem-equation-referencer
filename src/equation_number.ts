import { PluginValue, ViewUpdate } from '@codemirror/view';

import { SyntaxNodeRef } from '@lezer/common';
import { foldInside, syntaxTree } from '@codemirror/language';
import { EditorState, StateEffect, StateField, Transaction, RangeSetBuilder, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';

import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, TFile, Menu, setIcon, MetadataCache, SectionCache, MarkdownSectionInformation, MarkdownRenderer } from "obsidian";
import { getMathCache, getMathCacheFromPos, getMathTag, locToEditorPosition } from 'utils';


export class DisplayMathRenderChild extends MarkdownRenderChild {
    id: string | undefined;
    text: string | undefined;
    tag: string | undefined;

    constructor(containerEl: HTMLElement, public app: App, public context: MarkdownPostProcessorContext) {
        super(containerEl);
    }

    setId() {
        if (this.id === undefined) {
            let info = this.getInfo();
            let cache = this.getCache();
            if (cache && info) {
                let mathCache = getMathCache(cache, info.lineStart);
                if (mathCache && mathCache.id) {
                    this.id = mathCache.id;
                }
            }    
        }
    } 

    getCache(): CachedMetadata | null {
        return this.app.metadataCache.getCache(this.context.sourcePath);
    }

    getInfo(): MarkdownSectionInformation | null {
        return this.context.getSectionInfo(this.containerEl);
    }

    onload() {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.file.path == this.context.sourcePath) {
            this.setTextAndTag(view.editor);
        }

        if (this.text && this.tag) {
            replaceMathTag(this.containerEl, this.text, this.tag);
        }
    }

    printInfo() {
        console.log(`id = "${this.id}"`);
        console.log(`text = "${this.text}"`);
        console.log(`tag = "${this.tag}"`);
    }

    getTag(info: MarkdownSectionInformation): string {
        let tag = '';
        let cache = this.getCache();
        if (cache && info) {
            let mathCache = getMathCache(cache, info.lineStart);
            if (mathCache) {
                tag = getMathTag(cache, mathCache);
            }
        }
        return tag;
    }


    setTextAndTag(editor: Editor) {
        this.setId();
        let cache = this.app.metadataCache.getCache(this.context.sourcePath);
        if (cache && cache.sections) {
            let sectionCache = cache.sections.find(
                (sectionCache) => sectionCache.id == this.id
            );
            if (this.id && sectionCache && cache.frontmatter) {
                let from = locToEditorPosition(sectionCache.position.start);
                let to = locToEditorPosition(sectionCache.position.end);
                let text = editor.getRange(from, to);
                let tag = cache.frontmatter["mathLinks-block"][this.id];
                this.text = text;
                this.tag = tag;
            }
        }
    }

}


export function buildEquationNumberPlugin<V extends PluginValue>(app: App, path: string): ViewPlugin<V> {

    return ViewPlugin.fromClass(class implements PluginValue {
        constructor(public view: EditorView) {
            this.impl(this.view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged) {
                this.impl(update.view);
            }
        }

        impl(view: EditorView, tagAll?: string) {
            let displayMathElements = view.dom.querySelectorAll<HTMLElement>('mjx-container.MathJax mjx-math[display="true"]');
            let tag = tagAll ?? "";
            let cache = app.metadataCache.getCache(path);
            if (cache) {
                if (displayMathElements) {
                    for (let i = 0; i < displayMathElements.length; i++) {

                        try {

                        let displayMathEl = displayMathElements[i];
                        let pos = view.posAtDOM(displayMathEl);
                        console.log("---------------");
                        console.log(`displayMathEl = `, displayMathEl);
                        console.log(`pos = ${pos}`);
                        console.log("cache = ", cache);
                        // let line = view.state.doc.lineAt(pos);
                        // let lineNumber = line.number - 1; // CodeMirror6 uses 1-origin line numbers
                        let mathCache = getMathCacheFromPos(cache, pos);
                        if (tagAll === undefined && mathCache) {
                            tag = getMathTag(cache, mathCache);
                            if (tag) {
                                let text = getMathText(view, mathCache);
                                
                                console.log(`text = "${text}"`);
                                console.log(`tag = "${tag}"`);
                                replaceMathTag(displayMathEl, text, tag);
                            }
                        }
                    } catch (err) {
                        // console.log(err);
                        throw err;
                    }
                }
                }
            }
        }

        destroy() {
        }
    });
}



function getTagEl(displayMathEl: HTMLElement): HTMLElement | null {
    // displayMathEl: HTMLElement selected by 'mjx-container.MathJax mjx-math[display="true"]'
    return displayMathEl.querySelector<HTMLElement>("mjx-mtext.mjx-n");
}


// function replaceMathTag(tagEl: HTMLElement, tag: string): void {
//     // replace the tag number as (@) => ([tag])
//     let numberEl = renderMath("\\text{" + tag + "}", false);
//     finishRenderMath();

//     let contentEl = numberEl.querySelector("mjx-mtext.mjx-n");
//     if (contentEl) {
//         contentEl.classList.add("auto-number");
//         tagEl.replaceWith(contentEl);
//     }
// }


// function isAutoNumbered(tagEl: HTMLElement): boolean {
//     if (tagEl) {
//         if (tagEl.classList.contains("auto-number")) {
//             return true;
//         }

//         let tagCharElements = tagEl.children;
//         return Boolean(
//             tagCharElements.item(0)?.matches("mjx-c.mjx-c28")
//             && tagCharElements.item(1)?.matches("mjx-c.mjx-c40")
//             && tagCharElements.item(2)?.matches("mjx-c.mjx-c29")
//         );
//     }
//     return false;
// }


export function getMathText(view: EditorView, mathCache: SectionCache) {
    let from = mathCache.position.start.offset;
    let to = mathCache.position.end.offset;
    let text = view.state.sliceDoc(from, to);
    return text;
}


export function getMathTextWithTag(text: string, tag: string): string | undefined {
    let textResult = text.match(/^\$\$([\s\S]*)\$\$/);
    let tagResult = tag.match(/^\((.*)\)$/);
    if (textResult && tagResult) {
        return textResult[1].replace(/[\n\r]/g, ' ') + `\\tag{${tagResult[1]}}`;
    }
}


export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string) {
    let taggedText = getMathTextWithTag(text, tag);
    console.log(`taggedText = "${taggedText}"`);
    if (taggedText) {
        let mjxContainerEl = renderMath(taggedText, true);
        finishRenderMath();

        let parentNode = displayMathEl.parentNode;
        let parentEl = displayMathEl.parentElement;

        if (parentEl && parentNode) {
            let grandParentEl = parentNode.parentElement;
            if (grandParentEl) {
                grandParentEl.removeChild(parentNode);
                grandParentEl.appendChild(mjxContainerEl);
            }
           
        }
        
        

        // let mjxMathEl = mjxContainerEl.querySelector<HTMLElement>("mjx-math");
        // if (mjxMathEl) {
        //     console.log("I WAS CALLED");
        //     console.log(mjxMathEl);
        //     displayMathEl.replaceWith(mjxMathEl);
        // }
    }
}



// export function markdownPostProcessor(element: HTMLElement, context: MarkdownPostProcessorContext) {
//     console.log("sec:", this.app.metadataCache.getCache(context.sourcePath)?.sections);
//     console.log("el:", element);
//     console.log("child:", element.children);
//     let displayMathElements = element.querySelectorAll<HTMLElement>('mjx-container.MathJax mjx-math[display="true"]');
//     console.log("mathels:", displayMathElements);
//     if (displayMathElements) {
//         displayMathElements.forEach((displayMathEl) => {
//             let tag = '';
//             let cache = this.app.metadataCache.getCache(context.sourcePath);
//             let info = context.getSectionInfo(displayMathEl);
//             console.log("outside:cache:", cache);
//             console.log("outside:info:", info);
//             if (cache && info) {
//                 let mathCache = getMathCache(cache, info.lineStart);
//                 if (mathCache) {
//                     tag = getMathTag(cache, mathCache);
//                     console.log("inside:mathCache:", mathCache);
//                     console.log("inside:tag:", tag);
//                 }
//             }
//             context.addChild(new DisplayMathRenderChild(displayMathEl, context, tag));
//         });
//     }
// }

