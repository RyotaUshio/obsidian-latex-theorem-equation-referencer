import { StateField, EditorState, Transaction, RangeSet, RangeValue, RangeSetBuilder, Text } from '@codemirror/state';
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
        return buildField(plugin, state, state.doc);
    },
    update(value: RangeSet<TheoremCalloutInfo>, tr: Transaction) {
        // because the field is perfectly determine by the document content, 
        // we don't need to update it when the document is not changed
        if (!tr.docChanged) return value;

        // TODO: lighter-weight update
        // - Document changes only affects theorem callouts after the insertion point
        return buildField(plugin, tr.state, tr.newDoc); // use tr.newDoc instead of tr.state.doc because "Contrary to .state.doc, accessing this won't force the entire new state to be computed right away" (from CM6 docs)
    }
});


function buildField(plugin: MathBooster, state: EditorState, newDoc: Text) {
    const builder = new RangeSetBuilder<TheoremCalloutInfo>();
    // syntaxTree returns a potentially imcomplete tree (limited by viewport), so we need to ensure it's complete
    const tree = ensureSyntaxTree(state, newDoc.length) ?? syntaxTree(state);

    let theoremIndex = 0; // incremented when a auto-numbered theorem is found

    tree.iterate({
        from: 0, to: Infinity,
        enter(node) {
            if (node.name === 'Document') return; // skip the node for the entire document

            if (node.node.parent?.name !== 'Document') return false; // skip sub-nodes of a line

            const text = newDoc.sliceString(node.from, node.to);

            const match = node.name.match(CALLOUT);
            if (!match) return false;

            const settings = readTheoremCalloutSettings(text, plugin.extraSettings.excludeExampleCallout);
            if (!settings) return false;

            builder.add(
                node.from, node.to,
                new TheoremCalloutInfo(settings.number === 'auto' ? theoremIndex++ : null)
            );

            return false;
        }
    });

    const result = builder.finish();

    return result;
}
