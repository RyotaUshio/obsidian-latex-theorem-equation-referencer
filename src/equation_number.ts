import MathPlugin from 'main';
import { App, Editor, MarkdownRenderChild, renderMath, finishRenderMath, MarkdownPostProcessorContext, MarkdownView, CachedMetadata, SectionCache, MarkdownSectionInformation } from "obsidian";
import { EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view';

import { getMathCache, getMathCacheFromPos, getMathTag, locToEditorPosition } from 'utils';
import { resolveSettings } from 'autoIndex';


export class DisplayMathRenderChild extends MarkdownRenderChild {
    id: string | undefined;
    text: string | undefined;
    tag: string | undefined;

    constructor(containerEl: HTMLElement, public app: App, public plugin: MathPlugin, public context: MarkdownPostProcessorContext) {
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

        if (view && this.text && this.tag) {
            let settings = resolveSettings(undefined, this.plugin, view.file);
            replaceMathTag(this.containerEl, this.text, this.tag, Boolean(settings.lineByLine));
        }
    }

    getTag(info: MarkdownSectionInformation): string {
        let tag = '';
        let cache = this.getCache();
        if (cache && info) {
            let mathCache = getMathCache(cache, info.lineStart);
            if (mathCache) {
                tag = getMathTag(this.plugin, this.context.sourcePath, mathCache);
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
                let tag = this.plugin.mathLinksAPI.get(this.context.sourcePath, this.id);
                this.text = text;
                this.tag = tag;
            }
        }
    }

}


export function buildEquationNumberPlugin<V extends PluginValue>(app: App, plugin: MathPlugin, path: string, lineByLine: boolean): ViewPlugin<V> {

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
                                tag = getMathTag(plugin, path, mathCache);
                            } catch (err) {
                                // retry later if it was too soons (= cache is not readly yet)
                            }

                            let text = getMathText(view, mathCache);
                            replaceMathTag(displayMathEl, text, tag, lineByLine);
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


export function getMathTextWithTag(text: string, tag: string, lineByLine?: boolean): string | undefined {
    let textResult = text.match(/^\$\$([\s\S]*)\$\$/);
    let tagResult = tag.match(/^\((.*)\)$/);
    if (textResult && tagResult) {
        let textContent = textResult[1];
        let tagContent = tagResult[1];
        return insertTagInMathText(textContent, tagContent, lineByLine);
    }
}

export function insertTagInMathText(textContent: string, tagContent: string, lineByLine?: boolean): string {
    if (lineByLine) {
        let alignResult = textContent.match(/^\s*\\begin\{align\}([\s\S]*)\\end\{align\}\s*$/);
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
        }
    }
    return textContent.replace(/[\n\r]/g, ' ') + `\\tag{${tagContent}}`;

}


export function replaceMathTag(displayMathEl: HTMLElement, text: string, tag: string, lineByLine: boolean) {
    let tagMatch = text.match(/\\tag\{.*\}/);
    if (tagMatch) {
        return;
    }

    if (!tag) {
        let tagEls = displayMathEl.getElementsByClassName("auto-numbered");
        if (tagEls) {
            for (let i = 0; i < tagEls.length; i++) {
                let tagEl = tagEls[i];
                tagEl.remove();
            }
        }
        return;
    }

    let taggedText = getMathTextWithTag(text, tag, lineByLine);
    if (taggedText) {
        let mjxContainerEl = renderMath(taggedText, true);
        finishRenderMath();
        let parentEl = displayMathEl.parentElement;
        if (parentEl) {
            let tagEl = mjxContainerEl.querySelector<HTMLElement>('mjx-itable[align="right"]');
            if (tagEl) {
                tagEl.classList.add("auto-numbered");
            }
            parentEl.replaceWith(mjxContainerEl);
        }
    }
}
