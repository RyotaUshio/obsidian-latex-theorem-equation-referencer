import { MathIndex } from 'index';
import { MarkdownPage, MathBoosterBlock } from 'index/typings/markdown';
import MathBooster from 'main';
import { TFile, HeadingSubpathResult, BlockSubpathResult, App } from 'obsidian';
import * as MathLinks from 'obsidian-mathlinks';

export class CleverRefProvider extends MathLinks.Provider {
    app: App;
    index: MathIndex;

    constructor(mathLinks: any, plugin: MathBooster) {
        super(mathLinks);
        this.app = plugin.app;
        this.index = plugin.indexManager.index;
    }

    provide(
        parsedLinktext: { path: string; subpath: string; },
        targetFile: TFile | null, 
        targetSubpathResult: HeadingSubpathResult | BlockSubpathResult | null, 
    ): string | null {
        // Only care about block references
        if (targetSubpathResult?.type !== 'block') return null;

        if (targetFile === null) return null;
        const page = this.index.load(targetFile.path);
        if (!MarkdownPage.isMarkdownPage(page)) return null

        const block = page.$blocks.get(targetSubpathResult.block.id);
        
        if (block instanceof MathBoosterBlock && block.$refName !== null) {
            const linkpath = parsedLinktext.path;
            return linkpath ? linkpath + ' > ' + block.$refName : block.$refName;
        }

        return null;
    }
}