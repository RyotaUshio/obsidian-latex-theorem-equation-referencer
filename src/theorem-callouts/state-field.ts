import { StateField, EditorState, Transaction, RangeSet, RangeValue, Range, Text } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';

import LatexReferencer from 'main';
import { readTheoremCalloutSettings } from 'utils/parse';
import { editorInfoField } from 'obsidian';

import { THEOREM_LIKE_ENV_IDs, TheoremLikeEnvID } from 'env';

export const CALLOUT = /HyperMD-callout_HyperMD-quote_HyperMD-quote-([1-9][0-9]*)/;

export class TheoremCalloutInfo extends RangeValue {
    constructor(public index: number | null, public type: string) {
        super();
    }
}

function createEmptyCalloutInits(): Record<string, number> {
    let inits = {} as Record<string, number>;
    THEOREM_LIKE_ENV_IDs.forEach((id, _) => {
        inits[id] = 0
    });
    return inits;
}

export const createTheoremCalloutsField = (plugin: LatexReferencer) => StateField.define<RangeSet<TheoremCalloutInfo>>({
    create(state: EditorState) {
        // Since because canvas files cannot be indexed currently,
        // do not number theorems in canvas to make live preview consistent with reading view
        if (!state.field(editorInfoField).file) return RangeSet.empty;

        const ranges = getTheoremCalloutInfos(plugin, state, state.doc, 0, createEmptyCalloutInits());
        return RangeSet.of(ranges);
    },
    update(value: RangeSet<TheoremCalloutInfo>, tr: Transaction) {
        // Since because canvas files cannot be indexed currently,
        // do not number theorems in canvas to make live preview consistent with reading view
        if (!tr.state.field(editorInfoField).file) return RangeSet.empty;

        // Because the field can be perfectly determined by the document content, 
        // we don't need to update it when the document is not changed
        if (!tr.docChanged) return value;

        // In order to make the updates efficient, we only update the theorem callout infos that are affected by the changes, 
        // that is, theorem callouts after the insertion point.

        // Here, we use tr.newDoc instead of tr.state.doc because "Contrary to .state.doc, accessing this won't force the entire new state to be computed right away" (from CM6 docs)

        let minChangedPosition = tr.newDoc.length - 1;
        const changeDesc = tr.changes.desc;
        changeDesc.iterChangedRanges((fromA, toA, fromB, toB) => {
            if (fromB < minChangedPosition) {
                minChangedPosition = fromB;
            }
        });

        value = value.map(changeDesc);

        let inits = createEmptyCalloutInits();
        value.between(0, minChangedPosition, (from, to, info) => {
            if (to < minChangedPosition && info.index !== null) inits[info.type] = info.index + 1;
        });

        const updatedRanges = getTheoremCalloutInfos(plugin, tr.state, tr.newDoc, minChangedPosition, inits);
        return value.update({
            add: updatedRanges,
            filter: () => false,
            filterFrom: minChangedPosition,
        });
    }
});


function getTheoremCalloutInfos(plugin: LatexReferencer, state: EditorState, doc: Text, from: number, inits: Record<string, number>): Range<TheoremCalloutInfo>[] {
    const ranges: Range<TheoremCalloutInfo>[] = [];
    // syntaxTree returns a potentially imcomplete tree (limited by viewport), so we need to ensure it's complete
    const tree = ensureSyntaxTree(state, doc.length) ?? syntaxTree(state);

    let theoremIndexes = inits; // incremented when a auto-numbered theorem is found

    tree.iterate({
        from, to: doc.length,
        enter(node) {
            if (node.name === 'Document') return; // skip the node for the entire document

            if (node.node.parent?.name !== 'Document') return false; // skip sub-nodes of a line

            const text = doc.sliceString(node.from, node.to);

            const match = node.name.match(CALLOUT);
            if (!match) return false;

            const settings = readTheoremCalloutSettings(text, plugin.extraSettings.excludeExampleCallout);
            if (!settings) return false;

            const value = new TheoremCalloutInfo(settings.number === 'auto' ? theoremIndexes[settings.type]++ : null, settings.type);
            const range = value.range(node.from, node.to);
            ranges.push(range);

            return false;
        }
    });

    return ranges;
}
