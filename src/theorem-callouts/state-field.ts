import MathBooster from 'main';
import { syntaxTree } from '@codemirror/language';
import { StateField, EditorState, Transaction, RangeSet, RangeValue, RangeSetBuilder } from '@codemirror/state';
import { CALLOUT } from 'theorem_callout_metadata_hider';
import { nodeText } from 'utils/editor';
import { readTheoremCalloutSettings } from 'utils/parse';

export class TheoremCalloutInfo extends RangeValue {
    constructor(public index: number | null) {
        super();
    }
}

export const createTheoremCalloutsField = (plugin: MathBooster) => StateField.define<RangeSet<TheoremCalloutInfo>>({
    create(state: EditorState) {
        return buildField(plugin, state);
    },
    update(value: RangeSet<TheoremCalloutInfo>, tr: Transaction) {
        // because the field is perfectly determine by the document content, 
        // we don't need to update it when the document is not changed
        if (!tr.docChanged) return value;

        // TODO: lighter-weight update
        return buildField(plugin, tr.state);
    }
});


function buildField(plugin: MathBooster, state: EditorState) {
    const builder = new RangeSetBuilder<TheoremCalloutInfo>();
    const tree = syntaxTree(state);

    let theoremIndex = 0; // incremented when a auto-numbered theorem is found

    tree.iterate({
        enter(node) {
            const match = node.name.match(CALLOUT);
            if (!match) return;

            const text = nodeText(node, state);
            const settings = readTheoremCalloutSettings(text, plugin.extraSettings.excludeExampleCallout);
            if (!settings) return;

            builder.add(
                node.from, node.to,
                new TheoremCalloutInfo(settings.number === 'auto' ? theoremIndex++ : null)
            );

            return false;
        }
    });

    return builder.finish();
}
