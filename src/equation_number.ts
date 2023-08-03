import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, SectionCache, MarkdownSectionInformation, } from "obsidian";
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

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
                let tag = cache.frontmatter["mathLink-blocks"][this.id];
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
                        let displayMathEl = displayMathElements[i];
                        let pos = view.posAtDOM(displayMathEl);
                        let mathCache = getMathCacheFromPos(cache, pos);
                        if (tagAll === undefined && mathCache) {
                            try {
                                tag = getMathTag(cache, mathCache);
                            } catch (err) {
                                // retry later if it was too soon
                            }
                            if (tag) {
                                let text = getMathText(view, mathCache);
                                replaceMathTag(displayMathEl, text, tag);
                            }
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
        let textContent = textResult[1];
        let tagContent = tagResult[1];
        return insertTagInMathText(textContent, tagContent);
    }
}

export function insertTagInMathText(textContent: string, tagContent: string): string {
    let alignResult = textContent.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
    console.log(`textContent = ${textContent}`);
    console.log(`tagContent = ${tagContent}`);
    if (alignResult) {
        let taggedText = "";
        let index = 1;
        for (let line of alignResult[1].split("\\\\")) {
            if (line.trim()) {
                taggedText += line.contains("\\nonumber") ?
                line :
                line.trim() + `\\tag{${tagContent}-${index++}}`;
                taggedText += "\\\\";
            }
        }
        return "\\begin{align}" + taggedText + "\\end{align}";
    } else {
        return textContent.replace(/[\n\r]/g, ' ') + `\\tag{${tagContent}}`;
    }
}



export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string) {
    let tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }
    let taggedText = getMathTextWithTag(text, tag);
    if (taggedText) {
        let mjxContainerEl = renderMath(taggedText, true);
        finishRenderMath();
        let parentEl = displayMathEl.parentElement;
        if (parentEl) {
            parentEl.replaceWith(mjxContainerEl);
        }
    }
}
