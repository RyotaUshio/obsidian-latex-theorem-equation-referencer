import { RangeSetBuilder } from '@codemirror/state';
import { Transaction } from '@codemirror/state';
import { StateField, EditorState } from '@codemirror/state';
import { App, MarkdownPostProcessorContext, MarkdownRenderChild, editorInfoField } from 'obsidian';

import MathBooster from './main';
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { foldService, syntaxTree } from '@codemirror/language';
import { hasOverlap, nodeText, resolveSettings, renderMarkdown } from './utils';
import { Profile } from './settings/profile';
import { SyntaxNodeRef } from '@lezer/common';


export const INLINE_CODE = "inline-code";
export const LINK_BEGIN = "formatting-link_formatting-link-start";
export const LINK = "hmd-internal-link";
export const LINK_END = "formatting-link_formatting-link-end";


function makeProofClasses(which: "begin" | "end", profile: Profile) {
    return ["math-booster-" + which + "-proof",
    ...profile.meta.tags.map((tag) => "math-booster-" + which + "-proof-" + tag)];
}

function makeProofElement(which: "begin" | "end", profile: Profile) {
    return createSpan({
        text: profile.body.proof[which],
        cls: makeProofClasses(which, profile)
    })
}

function parseAtSignLink(codeEl: HTMLElement) {
    const next = codeEl.nextSibling;
    const afterNext = next?.nextSibling;
    const afterAfterNext = afterNext?.nextSibling;
    if (afterNext) {
        if (next.nodeType == Node.TEXT_NODE && next.textContent == "@"
            && afterNext instanceof HTMLElement && afterNext.matches("a.internal-link")
            && afterAfterNext instanceof HTMLElement && afterAfterNext.matches("a.mathLink-internal-link")) {
            return { atSign: next, links: [afterNext, afterAfterNext] };
        }
    }
}



/** For reading view */

export class ProofRenderChild extends MarkdownRenderChild {
    constructor(public app: App, public plugin: MathBooster, containerEl: HTMLElement, public which: "begin" | "end", public profile: Profile, public display?: string, public sourcePath?: string) {
        super(containerEl);
    }

    onload(): void {
        const result = parseAtSignLink(this.containerEl);

        /**
         * `\begin{proof}`@[[<link to Theorem 1>]] => Proof of Theorem 1.
         */
        if (result) {
            const { atSign, links } = result;
            const el = createSpan({ cls: makeProofClasses(this.which, this.profile) });
            el.replaceChildren(this.profile.body.proof.linkedBeginPrefix, ...links, this.profile.body.proof.linkedBeginSuffix);
            this.containerEl.replaceWith(el);
            atSign.textContent = "";
            return;
        }

        /**
         * `\begin{proof}[Foo.]` => Foo.
         */
        if (this.display && this.sourcePath) {
            this.renderDisplay();
            return;
        }

        /**
         * `\begin{proof}` => Proof.
         */
        this.containerEl.replaceWith(makeProofElement(this.which, this.profile));
    }

    async renderDisplay() {
        if (this.display && this.sourcePath) {
            const children = await renderMarkdown(this.display, this.sourcePath, this.plugin);
            if (children) {
                const el = createSpan({ cls: makeProofClasses(this.which, this.profile) });
                el.replaceChildren(...children);
                this.containerEl.replaceWith(el);
            }
        }
    }
}

export const ProofProcessor = (app: App, plugin: MathBooster, element: HTMLElement, context: MarkdownPostProcessorContext) => {
    const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file) return;

    const codes = element.querySelectorAll<HTMLElement>("code");
    const settings = resolveSettings(undefined, plugin, file);
    const profile = plugin.extraSettings.profiles[settings.profile];
    for (const code of codes) {
        const text = code.textContent;
        if (!text) continue;

        if (text.startsWith(settings.beginProof)) {
            const rest = text.slice(settings.beginProof.length);
            let displayMatch;
            if (!rest) {
                context.addChild(new ProofRenderChild(app, plugin, code, "begin", profile));
            } else if (displayMatch = rest.match(/^\[(.*)\]$/)) {
                const display = displayMatch[1];
                context.addChild(new ProofRenderChild(app, plugin, code, "begin", profile, display, context.sourcePath));
            }
        } else if (code.textContent == settings.endProof) {
            context.addChild(new ProofRenderChild(app, plugin, code, "end", profile));
        }
    }
};


/** For live preview */

class ProofWidget extends WidgetType {
    constructor(public which: "begin" | "end", public pos: ProofPosition, public profile: Profile, public sourcePath?: string, public plugin?: MathBooster) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        if (this.which == "begin" && this.sourcePath && this.plugin) {
            const el = createSpan({ cls: makeProofClasses(this.which, this.profile) });
            const display = this.pos.linktext ? `${this.profile.body.proof.linkedBeginPrefix} [[${this.pos.linktext}]]${this.profile.body.proof.linkedBeginSuffix}` : this.pos.display;
            if (display) {
                ProofWidget.renderDisplay(el, display, this.sourcePath, this.plugin);
                return el;
            }
        }
        return makeProofElement(this.which, this.profile);
    }

    static async renderDisplay(el: HTMLElement, display: string, sourcePath: string, plugin: MathBooster) {
        const children = await renderMarkdown(display, sourcePath, plugin);
        if (children) {
            el.replaceChildren(...children);
        }
    }
}


export interface ProofPosition {
    begin?: { from: number, to: number },
    end?: { from: number, to: number },
    display?: string,
    linktext?: string,
    linknodes?: { linkBegin: SyntaxNodeRef, link: SyntaxNodeRef, linkEnd: SyntaxNodeRef },
}

export const proofPositionFieldFactory = (plugin: MathBooster) => StateField.define<ProofPosition[]>({
    create(state: EditorState) {
        return makeField(state, plugin);
    },
    update(value: ProofPosition[], tr: Transaction) {
        if (!tr.docChanged) {
            return value;
        }
        return makeField(tr.state, plugin);
    }
});


function makeField(state: EditorState, plugin: MathBooster) {
    const file = state.field(editorInfoField).file;
    if (!file) return [];

    const settings = resolveSettings(undefined, plugin, file);

    const field: ProofPosition[] = [];
    const tree = syntaxTree(state);
    let begin: { from: number, to: number } | undefined;
    let end: { from: number, to: number } | undefined;
    let display: string | undefined;
    let displayMatch;
    let linktext: string | undefined;
    let linknodes: { linkBegin: SyntaxNodeRef, link: SyntaxNodeRef, linkEnd: SyntaxNodeRef } | undefined;
    tree.iterate({
        enter(node) {
            if (node.name == INLINE_CODE) {
                const text = nodeText(node, state);
                if (text.startsWith(settings.beginProof)) {
                    const rest = text.slice(settings.beginProof.length);
                    if (!rest) {
                        begin = { from: node.from - 1, to: node.to + 1 }; // 1 = "`".length
                    } else if (displayMatch = rest.match(/^\[(.*)\]$/)) {
                        display = displayMatch[1];
                        begin = { from: node.from - 1, to: node.to + 1 }; // 1 = "`".length
                    }
                    if (begin && state.sliceDoc(node.to + 1, node.to + 2) == "@") {
                        const next = node.node.nextSibling?.nextSibling;
                        const afterNext = node.node.nextSibling?.nextSibling?.nextSibling;
                        const afterAfterNext = node.node.nextSibling?.nextSibling?.nextSibling?.nextSibling;
                        if (next?.name == LINK_BEGIN && afterNext?.name == LINK && afterAfterNext?.name == LINK_END) {
                            linktext = nodeText(afterNext, state);
                            linknodes = { linkBegin: next, link: afterNext, linkEnd: afterAfterNext };
                        }
                    }
                } else if (text == settings.endProof) {
                    end = { from: node.from - 1, to: node.to + 1 }; // 1 = "`".length
                    field.push({ begin, end, display, linktext, linknodes });
                    begin = undefined;
                    end = undefined;
                    display = undefined;
                    linktext = undefined;
                    linknodes = undefined;
                }
            }
        }
    });
    if (begin) {
        field.push({ begin, end, display, linktext, linknodes });
    }
    return field;
}


export const proofDecorationFactory = (plugin: MathBooster) => ViewPlugin.fromClass(
    class implements PluginValue {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.impl(view);
        }

        update(update: ViewUpdate): void {
            this.impl(update.view);
        }

        impl(view: EditorView) {
            const file = view.state.field(editorInfoField).file;
            if (!file) {
                this.decorations = Decoration.none;
                return;
            }

            const settings = resolveSettings(undefined, plugin, file);
            const profile = plugin.extraSettings.profiles[settings.profile];

            const builder = new RangeSetBuilder<Decoration>();
            const range = view.state.selection.main;
            const positions = view.state.field(plugin.proofPositionField);

            for (const pos of positions) {
                if (pos.begin) {
                    if (pos.linktext && pos.linknodes) {
                        if (!hasOverlap({ from: pos.begin.from, to: pos.linknodes.linkEnd.to }, range)) {
                            builder.add(
                                pos.begin.from,
                                pos.linknodes.linkEnd.to,
                                Decoration.replace({
                                    widget: new ProofWidget("begin", pos, profile, file.path, plugin)
                                })
                            );
                        }
                    } else if (!hasOverlap(pos.begin, range)) {
                        builder.add(
                            pos.begin.from,
                            pos.begin.to,
                            Decoration.replace({
                                widget: new ProofWidget("begin", pos, profile, file.path, plugin)
                            })
                        );
                    }
                }
                if (pos.end && !hasOverlap(pos.end, range)) {
                    builder.add(
                        pos.end.from,
                        pos.end.to,
                        Decoration.replace({
                            widget: new ProofWidget("end", pos, profile)
                        })
                    );
                }
            }
            this.decorations = builder.finish();
        }
    }, {
    decorations: instance => instance.decorations
});


export const proofFoldFactory = (plugin: MathBooster) => foldService.of((state: EditorState, lineStart: number, lineEnd: number) => {
    const positions = state.field(plugin.proofPositionField);
    for (const pos of positions) {
        if (pos.begin && pos.end && lineStart <= pos.begin.from && pos.begin.to <= lineEnd) {
            return { from: pos.begin.to, to: pos.end.to };
        }
    }
    return null;
});
