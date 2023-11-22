import { EditorSuggest, TFile, renderMath } from "obsidian";
import { around } from "monkey-around";

import MathBooster from "main";
import { MarkdownPage, TheoremCalloutBlock } from 'index/typings/markdown';
import { isTheoremCallout, resolveSettings } from 'utils/plugin';
import { formatTitle } from 'utils/format';
import { _readTheoremCalloutSettings } from 'utils/parse';
import { capitalize } from 'utils/general';

export const patchLinkCompletion = (plugin: MathBooster) => {
    const prototype = (plugin.app.workspace as any).editorSuggest.suggests[0].constructor.prototype as EditorSuggest<any>;
    console.log(prototype)

    plugin.register(around(prototype, {
        renderSuggestion(old) {
            return function (item: any, el: HTMLElement) {
                if (plugin.extraSettings.showTheoremTitleinBuiltin && item.type === 'block' && item.node.type === 'callout' && isTheoremCallout(plugin, item.node.callout.type)) {
                    let title: string = item.node.children.find((child: any) => child.type === 'callout-title')?.children[0].value ?? '';
                    const content = item.display.slice(title.length);
                    const id = item.node.id;
                    const page = plugin.indexManager.index.load(item.file.path);
                    if (MarkdownPage.isMarkdownPage(page)) {
                        const block = page.getBlockByLineNumber(item.node.position.start.line - 1); // line number starts from 1
                        if (TheoremCalloutBlock.isTheoremCalloutBlock(block)) {
                            el.replaceChildren();
                            el.createDiv({ text: block.$printName });
                            if (content) el.createDiv({ text: content });
                            return;
                        }
                    }
                    const parsed = _readTheoremCalloutSettings({ type: item.node.callout.type, metadata: item.node.callout.data }, plugin.extraSettings.excludeExampleCallout);
                    if (parsed) {
                        const { type, number } = parsed;
                        if (title === capitalize(type)) title = '';
                        const formattedTitle = formatTitle(plugin, item.file as TFile, resolveSettings({ type, number, title }, plugin, item.file as TFile), true);
                        el.replaceChildren();
                        el.createDiv({ text: formattedTitle });
                        if (content) el.createDiv({ text: content });
                        return;
                    }
                } else if (plugin.extraSettings.renderEquationinBuiltin && item.type === "block" && item.node.type === 'math') {
                    el.replaceChildren();
                    el.appendChild(renderMath(item.node.value, true))
                    return;
                }

                old.call(this, item, el);
            }
        }
    }));
};
