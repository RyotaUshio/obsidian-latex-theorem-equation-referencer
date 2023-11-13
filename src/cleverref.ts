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
        sourceFile: TFile | null
    ): string | null {
        // Only care about block references
        if (targetSubpathResult?.type !== 'block') return null;

        if (targetFile === null) return null;
        const page = this.index.load(targetFile.path);
        if (!(page instanceof MarkdownPage)) return null

        const block = page.$blocks.get(targetSubpathResult.block.id);
        
        if (block instanceof MathBoosterBlock && block.$refName !== null) {
            const linktext = this.app.metadataCache.fileToLinktext(targetFile, sourceFile?.path ?? '');
            return linktext + ' > ' + block.$refName
        }

        return null;
    }
}