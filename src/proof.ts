import { RangeSetBuilder } from '@codemirror/state';
import { Transaction } from '@codemirror/state';
import { StateField, EditorState } from '@codemirror/state';
import { MarkdownPostProcessorContext, MarkdownRenderChild, editorInfoField } from 'obsidian';

import MathBooster from 'main';
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { hasOverlap, nodeText, resolveSettings } from 'utils';
import { MathContextSettings } from 'settings/settings';

export const INLINE_CODE = "inline-code";


/** For reading view */

export class BeginProof extends MarkdownRenderChild {
    constructor(containerEl: HTMLElement, public settings: Required<MathContextSettings>) {
        super(containerEl);
    }

    onload(): void {
        this.containerEl.replaceWith(
            createSpan({
                text: this.settings.beginProofReplace,
                cls: "math-booster-begin-proof",
            })
        );
    }
}

export class EndProof extends MarkdownRenderChild {
    constructor(containerEl: HTMLElement, public settings: Required<MathContextSettings>) {
        super(containerEl);
    }

    onload(): void {
        this.containerEl.replaceWith(
            createSpan({
                text: this.settings.endProofReplace,
                cls: "math-booster-end-proof",
            })
        );
    }
}

export const ProofProcessor = (element: HTMLElement, context: MarkdownPostProcessorContext, plugin: MathBooster) => {
    const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file) return;

    const codes = element.getElementsByTagName("code");
    const settings = resolveSettings(undefined, plugin, file);
    for (const code of codes) {
        if (code.textContent == settings.beginProof) {
            context.addChild(new BeginProof(code, settings));
        } else if (code.textContent == settings.endProof) {
            context.addChild(new EndProof(code, settings));
        }
    }
};


/** For live preview */

class BeginProofWidget extends WidgetType {
    constructor(public settings: Required<MathContextSettings>) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return createSpan({
            text: this.settings.beginProofReplace,
            cls: "math-booster-begin-proof",
        });
    }
}


class EndProofWidget extends WidgetType {
    constructor(public settings: Required<MathContextSettings>) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return createSpan({
            text: this.settings.endProofReplace,
            cls: "math-booster-end-proof",
        });
    }
}


export interface ProofPosition {
    begin?: { from: number, to: number },
    end?: { from: number, to: number }
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
    tree.iterate({
        enter(node) {
            if (node.name == INLINE_CODE) {
                const text = nodeText(node, state);
                if (text == settings.beginProof) {
                    begin = { from: node.from - 1, to: node.to + 1 } // 1 = "`".length
                } else if (text == settings.endProof) {
                    end = { from: node.from - 1, to: node.to + 1 }; // 1 = "`".length
                    field.push({ begin, end });
                }
            }
        }
    });
    return field;
}


export const proofDecorationFactory = (plugin: MathBooster, proofPositionField: StateField<ProofPosition[]>) => ViewPlugin.fromClass(
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

            const builder = new RangeSetBuilder<Decoration>();
            const range = view.state.selection.main;
            const positions = view.state.field(proofPositionField);

            for (const pos of positions) {
                if (pos.begin && !hasOverlap(pos.begin, range)) {
                    builder.add(
                        pos.begin.from,
                        pos.begin.to,
                        Decoration.replace({
                            widget: new BeginProofWidget(settings)
                        })
                    );
                }
                if (pos.end && !hasOverlap(pos.end, range)) {
                    builder.add(
                        pos.end.from,
                        pos.end.to,
                        Decoration.replace({
                            widget: new EndProofWidget(settings)
                        })
                    );
                }
            }
            this.decorations = builder.finish();
        }
    }, {
    decorations: instance => instance.decorations
});
