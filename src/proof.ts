import { RangeSetBuilder } from '@codemirror/state';
import { Transaction } from '@codemirror/state';
import { StateField, EditorState } from '@codemirror/state';
import { MarkdownPostProcessorContext, MarkdownRenderChild, editorInfoField } from 'obsidian';

import MathBooster from './main';
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { foldService, syntaxTree } from '@codemirror/language';
import { hasOverlap, nodeText, resolveSettings } from './utils';
import { MathContextSettings } from './settings/settings';
import { Profile } from 'profile';

export const INLINE_CODE = "inline-code";


function makeProofElement(which: "begin" | "end", settings: Required<MathContextSettings>, profile: Profile) {
    return createSpan({
        text: settings[(which + "ProofReplace") as "beginProofReplace" | "endProofReplace"],
        cls: [
            "math-booster-" + which + "-proof",
            ...profile.meta.tags.map((tag) => "math-booster-" + which + "-proof-" + tag)
        ]
    })
}


/** For reading view */

export class ProofRenderChild extends MarkdownRenderChild {
    constructor(containerEl: HTMLElement, public which: "begin" | "end", public settings: Required<MathContextSettings>, public profile: Profile) {
        super(containerEl);
    }

    onload(): void {
        this.containerEl.replaceWith(makeProofElement(this.which, this.settings, this.profile));
    }
}

export const ProofProcessor = (element: HTMLElement, context: MarkdownPostProcessorContext, plugin: MathBooster) => {
    const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file) return;

    const codes = element.querySelectorAll<HTMLElement>("code");
    const settings = resolveSettings(undefined, plugin, file);
    const profile = plugin.extraSettings.profiles[settings.profile];
    for (const code of codes) {
        if (code.textContent == settings.beginProof) {
            context.addChild(new ProofRenderChild(code, "begin", settings, profile));
        } else if (code.textContent == settings.endProof) {
            context.addChild(new ProofRenderChild(code, "end", settings, profile));
        }
    }
};


/** For live preview */

class ProofWidget extends WidgetType {
    constructor(public which: "begin" | "end", public settings: Required<MathContextSettings>, public profile: Profile) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        return makeProofElement(this.which, this.settings, this.profile);
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
                    begin = undefined;
                    end = undefined;
                }
            }
        }
    });
    if (!end && begin) {
        field.push({ begin });
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
                if (pos.begin && !hasOverlap(pos.begin, range)) {
                    builder.add(
                        pos.begin.from,
                        pos.begin.to,
                        Decoration.replace({
                            widget: new ProofWidget("begin", settings, profile)
                        })
                    );
                }
                if (pos.end && !hasOverlap(pos.end, range)) {
                    builder.add(
                        pos.end.from,
                        pos.end.to,
                        Decoration.replace({
                            widget: new ProofWidget("end", settings, profile)
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