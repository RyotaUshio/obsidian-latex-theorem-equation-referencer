/**
 * Display equation numbers in Live Preview.
 */

import { EditorState, StateEffect } from '@codemirror/state';
import { PluginValue, ViewPlugin, EditorView, ViewUpdate } from '@codemirror/view';
import { EquationBlock, MarkdownBlock, MarkdownPage } from 'index/typings/markdown';
import MathBooster from 'main';
import { MarkdownView, TFile, editorInfoField, finishRenderMath } from 'obsidian';
import { resolveSettings } from 'utils/plugin';
import { replaceMathTag } from './common';
import { DEFAULT_SETTINGS, MathContextSettings } from 'settings/settings';


export function createEquationNumberPlugin(plugin: MathBooster) {

    const { app, indexManager: { index } } = plugin;

    const forceUpdateEffect = StateEffect.define<null>();

    plugin.registerEvent(plugin.indexManager.on('index-updated', (file) => {
        app.workspace.iterateAllLeaves((leaf) => {
            if (
                leaf.view instanceof MarkdownView
                && leaf.view.file?.path === file.path
                && leaf.view.getMode() === 'source'
            ) {
                leaf.view.editor.cm?.dispatch({ effects: forceUpdateEffect.of(null) });
            }
        });
    }));

    return ViewPlugin.fromClass(class implements PluginValue {
        file: TFile | null;
        page: MarkdownPage | null;
        settings: Required<MathContextSettings>;

        constructor(view: EditorView) {
            this.file = view.state.field(editorInfoField).file;
            this.page = null;
            this.settings = DEFAULT_SETTINGS;

            if (this.file) {
                this.settings = resolveSettings(undefined, plugin, this.file);
                const page = index.load(this.file.path);
                if (MarkdownPage.isMarkdownPage(page)) {
                    this.page = page;
                    this.updateEquationNumber(view, this.page);
                }
            }
        }

        updateFile(state: EditorState) {
            this.file = state.field(editorInfoField).file;
        }

        async updatePage(file: TFile): Promise<MarkdownPage> {
            const page = index.load(file.path);
            if (MarkdownPage.isMarkdownPage(page)) this.page = page;
            if (!this.page) {
                this.page = await plugin.indexManager.reload(file);
            }
            return this.page;
        }

        update(update: ViewUpdate) {
            if (!this.file) this.updateFile(update.state);
            if (!this.file) return;

            if (update.transactions.some(tr => tr.effects.some(effect => effect.is(forceUpdateEffect)))) {
                // index updated
                this.settings = resolveSettings(undefined, plugin, this.file);
                this.updatePage(this.file).then((updatedPage) => this.updateEquationNumber(update.view, updatedPage))
            } else if (update.geometryChanged) {
                if (this.page) this.updateEquationNumber(update.view, this.page);
                else this.updatePage(this.file).then((updatedPage) => this.updateEquationNumber(update.view, updatedPage));
            }
        }

        async updateEquationNumber(view: EditorView, page: MarkdownPage) {
            const mjxContainerElements = view.contentDOM.querySelectorAll<HTMLElement>(':scope > .cm-embed-block.math > mjx-container.MathJax[display="true"]');

            for (const mjxContainerEl of mjxContainerElements) {

                const pos = view.posAtDOM(mjxContainerEl);
                let block: MarkdownBlock | undefined;
                try {
                    const line = view.state.doc.lineAt(pos).number - 1; // sometimes throws an error for reasons that I don't understand
                    block = page.getBlockByLineNumber(line);
                } catch (err) {
                    block = page.getBlockByOffset(pos);
                }
                if (!(block instanceof EquationBlock)) continue;

                // only update if necessary
                if (mjxContainerEl.getAttribute('data-equation-print-name') !== block.$printName) {
                    replaceMathTag(mjxContainerEl, block, this.settings);
                }
                if (block.$printName !== null) mjxContainerEl.setAttribute('data-equation-print-name', block.$printName);
                else mjxContainerEl.removeAttribute('data-equation-print-name');
            }
            // DON'T FOREGET THIS CALL!!
            // https://github.com/RyotaUshio/obsidian-math-booster/issues/203
            // https://github.com/RyotaUshio/obsidian-math-booster/issues/200
            finishRenderMath();
        }

        destroy() {
            // I don't know if this is really necessary, but just in case...
            finishRenderMath();
        }
    });
}
