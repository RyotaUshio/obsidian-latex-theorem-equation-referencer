/**
 * Display equation numbers in Live Preview.
 */


import { StateEffect } from '@codemirror/state';
import { PluginValue, ViewPlugin, EditorView, ViewUpdate } from '@codemirror/view';
import { EquationBlock, MarkdownPage } from 'index/typings/markdown';
import MathBooster from 'main';
import { MarkdownView, TFile, editorInfoField, finishRenderMath } from 'obsidian';
import { resolveSettings } from 'utils/plugin';
import { replaceMathTag } from './common';


export function createEquationNumberPlugin<V extends PluginValue>(plugin: MathBooster): ViewPlugin<V> {

    const { app, indexManager: { index } } = plugin;

    const forceUpdateEffect = StateEffect.define<null>();

    plugin.registerEvent(app.metadataCache.on('math-booster:index-updated', (file) => {
        app.workspace.iterateAllLeaves((leaf) => {
            if (
                leaf.view instanceof MarkdownView
                && leaf.view.getMode() === 'source'
                // && backlinks.has(leaf.view.file.path) // TODO: auto-register file link from block link so that we can get backlinks properly
            ) {
                leaf.view.editor.cm?.dispatch({ effects: forceUpdateEffect.of(null) });
            }
        });
    }));

    return ViewPlugin.fromClass(class implements PluginValue {
        constructor(view: EditorView) {
            this.impl(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.transactions.some(tr => tr.effects.some(effect => effect.is(forceUpdateEffect)))) {
                this.impl(update.view);
            }
        }

        impl(view: EditorView) {
            const info = view.state.field(editorInfoField);
            if (info.file) {
                this.callback(view, info.file);
            }
        }

        async callback(view: EditorView, file: TFile) {
            const mjxContainerElements = view.contentDOM.querySelectorAll<HTMLElement>(':scope > mjx-container.MathJax[display="true"]');
            const settings = resolveSettings(undefined, plugin, file);
            const page = plugin.indexManager.index.load(file.path);
            if (!MarkdownPage.isMarkdownPage(page)) return;

            for (const mjxContainerEl of mjxContainerElements) {
                try {
                    const pos = view.posAtDOM(mjxContainerEl);
                    const line = view.state.doc.lineAt(pos).number - 1;
                    const block = page.getBlockByLineNumber(line);
                    if (!(block instanceof EquationBlock)) continue;

                    replaceMathTag(mjxContainerEl, block.$mathText, block.$printName, settings);

                } catch (err) {
                    // try it again later
                }
            }
        }

        destroy() {
            // I don't know when to call finishRenderMath...
            finishRenderMath();
        }
    });
}
