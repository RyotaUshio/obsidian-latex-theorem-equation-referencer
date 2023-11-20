import { PluginValue, EditorView, ViewUpdate, ViewPlugin } from '@codemirror/view';

import MathBooster from 'main';
import { MathIndex } from 'index';


export const createTheoremCalloutNumberingViewPlugin = (plugin: MathBooster) => ViewPlugin.fromClass(
    class implements PluginValue {
        index: MathIndex = plugin.indexManager.index;

        constructor(public view: EditorView) {
            // Wait until the initial rendering is done so that we can find the callout elements using qeurySelectorAll(). 
            setTimeout(() => this.impl(view));
        }
        update(update: ViewUpdate) {
            this.impl(update.view);
        }
        impl(view: EditorView) {
            const infos = view.state.field(plugin.theoremCalloutsField);

            for (const calloutEl of view.contentDOM.querySelectorAll<HTMLElement>('.callout.theorem-callout')) {
                const pos = view.posAtDOM(calloutEl);
                const index = infos.iter(pos).value?.index;
                if (typeof index === 'number') calloutEl.setAttribute('data-theorem-index', String(index));
                else calloutEl.removeAttribute('data-theorem-index');
            }
        }
    }
);
