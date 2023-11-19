import { StateField, EditorState, Transaction, RangeSet, RangeValue, Range, Text } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';

import MathBooster from 'main';
import { CALLOUT } from 'theorem_callout_metadata_hider';
import { readTheoremCalloutSettings } from 'utils/parse';


export class TheoremCalloutInfo extends RangeValue {
    constructor(public index: number | null) {
        super();
    }
}


export const createTheoremCalloutsField = (plugin: MathBooster) => StateField.define<RangeSet<TheoremCalloutInfo>>({
    create(state: EditorState) {
        const ranges = getTheoremCalloutInfos(plugin, state, state.doc, 0, 0);
        return RangeSet.of(ranges);
    },
    update(value: RangeSet<TheoremCalloutInfo>, tr: Transaction) {
        // Because the field can be perfectly determined by the document content, 
        // we don't need to update it when the document is not changed
        if (!tr.docChanged) return value;

        // In order to make the updates efficient, we only update the theorem callout infos that are affected by the changes, 
        // that is, theorem callouts after the insertion point.

        // Here, we use tr.newDoc instead of tr.state.doc because "Contrary to .state.doc, accessing this won't force the entire new state to be computed right away" (from CM6 docs)

        let minChangedPosition = tr.newDoc.length - 1;
        const changeDesc = tr.changes.desc;
        changeDesc.iterChangedRanges((fromA, toA, fromB, toB) => {
            if (fromB < minChangedPosition) minChangedPosition = fromB;
        });

        value = value.map(changeDesc);

        let init = 0;
        value.between(0, minChangedPosition, (from, to, info) => {
            if (info.index !== null) init = info.index + 1;
        });

        const updatedRanges = getTheoremCalloutInfos(plugin, tr.state, tr.newDoc, minChangedPosition, init);
        return value.update({
                add: updatedRanges,
                filter: () => false,
                filterFrom: minChangedPosition,
            });
    }
});


function getTheoremCalloutInfos(plugin: MathBooster, state: EditorState, doc: Text, from: number, init: number): Range<TheoremCalloutInfo>[] {
    const ranges: Range<TheoremCalloutInfo>[] = [];
    // syntaxTree returns a potentially imcomplete tree (limited by viewport), so we need to ensure it's complete
    const tree = ensureSyntaxTree(state, doc.length) ?? syntaxTree(state);

    let theoremIndex = init; // incremented when a auto-numbered theorem is found

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

            const value = new TheoremCalloutInfo(settings.number === 'auto' ? theoremIndex++ : null);
            const range = value.range(node.from, node.to);
            ranges.push(range);

            return false;
        }
    });

    return ranges;
}
