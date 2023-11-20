import { HoverParent } from 'obsidian';
import { around } from 'monkey-around';
import MathBooster from '../main';

// Inspired by Hover Editor (https://github.com/nothingislost/obsidian-hover-editor/blob/c038424acb15c542f0ad5f901d74c75d4316f553/src/main.ts#L396)

// Add "src" attribute to hover page preview elements so that we can get linktext to display theorem/equation numbers in it

export const patchPagePreview = (plugin: MathBooster) => {
    const { app } = plugin;

    plugin.register(
        // @ts-ignore
        around(app.internalPlugins.plugins['page-preview'].instance.constructor.prototype, {
            onLinkHover(old: Function) {
                return function(parent: HoverParent, targetEl: HTMLElement, linktext: string, ...args: unknown[]) {
                    old.call(this, parent, targetEl, linktext, ...args);
                    setTimeout(() => parent.hoverPopover?.hoverEl.setAttribute('src', linktext), 300);
                }
            }
        })
    );
}