import { EquationBlock } from 'index/typings/markdown';
import { TFile, HeadingSubpathResult, BlockSubpathResult, App } from 'obsidian';
import * as MathLinks from 'obsidian-mathlinks';

import MathBooster from 'main';
import { MathIndex } from 'index/math-index';
import { MarkdownPage, MathBoosterBlock, TheoremCalloutBlock } from 'index/typings/markdown';


export class CleverefProvider extends MathLinks.Provider {
    app: App;
    index: MathIndex;

    constructor(mathLinks: any, public plugin: MathBooster) {
        super(mathLinks);
        this.app = plugin.app;
        this.index = plugin.indexManager.index;
    }

    provide(
        parsedLinktext: { path: string; subpath: string; },
        targetFile: TFile | null,
        targetSubpathResult: HeadingSubpathResult | BlockSubpathResult | null,
    ): string | null {
        const { path, subpath } = parsedLinktext;
        if (targetFile === null) return null;
        const page = this.index.load(targetFile.path);
        if (!MarkdownPage.isMarkdownPage(page)) return null

        // only path, no subpath: return page.$refName if it exists, otherwise there's nothing to do
        if (!subpath) return page.$refName ?? null;

        const processedPath = path ? page.$refName ?? path : '';

        // subpath resolution failed, do nothing
        if (targetSubpathResult === null) return null;

        // subpath resolution succeeded
        if (targetSubpathResult.type === 'block') {
            // handle block links

            // get the target block
            const block = page.$blocks.get(targetSubpathResult.block.id);

            if (MathBoosterBlock.isMathBoosterBlock(block)) {
                // display text set manually: higher priority
                if (block.$display) return path && this.shouldShowNoteTitle(block) ? processedPath + ' > ' + block.$display : block.$display;
                // display text computed automatically: lower priority
                if (block.$refName) return path && this.shouldShowNoteTitle(block) ? processedPath + ' > ' + block.$refName : block.$refName;
            }
        } else {
            // handle heading links
            // just ignore (return null) if we don't need to perform any particular processing
            if (path && page.$refName) {
                return processedPath + ' > ' + subpath;
            }
        }

        return null;
    }

    shouldShowNoteTitle(block: MathBoosterBlock): boolean {
        if (TheoremCalloutBlock.isTheoremCalloutBlock(block)) return this.plugin.extraSettings.noteTitleInTheoremLink;
        if (EquationBlock.isEquationBlock(block)) return this.plugin.extraSettings.noteTitleInEquationLink;
        return true;
    }
}