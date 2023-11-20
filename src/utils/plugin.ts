import MathBooster from "main";
import { CachedMetadata, Editor, Notice, TAbstractFile, TFile } from "obsidian";
import { DEFAULT_SETTINGS, MathContextSettings, MinimalTheoremCalloutSettings, ResolvedMathSettings, TheoremCalloutSettings } from "settings/settings";
import { generateBlockID, getAncestors } from "./obsidian";
import { EquationBlock, MarkdownBlock, MarkdownPage, TheoremCalloutBlock } from "index/typings/markdown";
import { getIO } from "file-io";
import { splitIntoLines } from "./general";


export function resolveSettings(settings: MinimalTheoremCalloutSettings, plugin: MathBooster, currentFile: TAbstractFile): ResolvedMathSettings;
export function resolveSettings(settings: undefined, plugin: MathBooster, currentFile: TAbstractFile): Required<MathContextSettings>;
export function resolveSettings(settings: MinimalTheoremCalloutSettings | undefined, plugin: MathBooster, currentFile: TAbstractFile): Required<MathContextSettings> {
    /** Resolves settings. Does not overwride, but returns a new settings object.
     * Returned settings can be either 
     * - ResolvedMathContextSettings or 
     * - Required<MathContextSettings> & Partial<TheoremCalloutSettings>.
     * */
    const resolvedSettings = Object.assign({}, DEFAULT_SETTINGS);
    const ancestors = getAncestors(currentFile);
    for (const ancestor of ancestors) {
        Object.assign(resolvedSettings, plugin.settings[ancestor.path]);
    }
    Object.assign(resolvedSettings, settings);
    return resolvedSettings;
}

export function getProfile(plugin: MathBooster, file: TFile) {
    const settings = resolveSettings(undefined, plugin, file);
    const profile = plugin.extraSettings.profiles[settings.profile];
    return profile;
}

export function getProfileByID(plugin: MathBooster, profileID: string) {
    const profile = plugin.extraSettings.profiles[profileID];
    return profile;
}

export function staticifyEqNumber(plugin: MathBooster, file: TFile) {
    const page = plugin.indexManager.index.load(file.path);
    if (!MarkdownPage.isMarkdownPage(page)) {
        new Notice(`Failed to fetch the metadata of file ${file.path}.`);
        return;
    }
    const io = getIO(plugin, file);
    for (const block of page.$blocks.values()) {
        if (block instanceof EquationBlock && block.$printName !== null) {
            io.setRange(
                block.$pos,
                `$$\n${block.$mathText} \\tag{${block.$printName.slice(1, -1)}}\n$$`
            );
        }
    }
}

export async function insertBlockIdIfNotExist(plugin: MathBooster, targetFile: TFile, cache: CachedMetadata, block: MarkdownBlock, length: number = 6): Promise<{ id: string, lineAdded: number } | undefined> {
    // Make sure the section cache is fresh enough!
    if (!(cache?.sections)) return;

    if (block.$blockId) return { id: block.$blockId, lineAdded: 0 };

    // The section has no block ID, so let's create a new one
    const id = generateBlockID(cache, length);
    // and insert it
    const io = getIO(plugin, targetFile);
    await io.insertLine(block.$position.end + 1, "^" + id);
    await io.insertLine(block.$position.end + 1, "")
    return { id, lineAdded: 2 };
}

export function increaseQuoteLevel(content: string): string {
    let lines = content.split("\n");
    lines = lines.map((line) => "> " + line);
    return lines.join("\n");
}

/**
 * Correctly insert a display math even inside callouts or quotes.
 */
export function insertDisplayMath(editor: Editor) {
    const cursorPos = editor.getCursor();
    const line = editor.getLine(cursorPos.line).trimStart();
    const nonQuoteMatch = line.match(/[^>\s]/);

    const head = nonQuoteMatch?.index ?? line.length;
    const quoteLevel = line.slice(0, head).match(/>\s*/g)?.length ?? 0;
    let insert = "$$\n" + "> ".repeat(quoteLevel) + "\n" + "> ".repeat(quoteLevel) + "$$";

    editor.replaceRange(insert, cursorPos);
    cursorPos.line += 1;
    cursorPos.ch = quoteLevel * 2;
    editor.setCursor(cursorPos);
}

export async function rewriteTheoremCalloutFromV1ToV2(plugin: MathBooster, file: TFile) {
    const { app, indexManager } = plugin;

    const page = await indexManager.reload(file);
    await app.vault.process(file, (data) => convertTheoremCalloutFromV1ToV2(data, page));
}


export const convertTheoremCalloutFromV1ToV2 = (data: string, page: MarkdownPage) => {
    const lines = data.split('\n');
    const newLines = [...lines];
    let lineAdded = 0;

    for (const section of page.$sections) {
        for (const block of section.$blocks) {
            if (!TheoremCalloutBlock.isTheoremCalloutBlock(block)) continue;
            if (!block.$v1) continue

            const newHeadLines = [generateTheoremCalloutFirstLine({
                type: block.$settings.type,
                number: block.$settings.number,
                title: block.$settings.title
            })];
            const legacySettings = block.$settings as any;
            if (legacySettings.label) newHeadLines.push(`> %% label: ${legacySettings.label} %%`);
            if (legacySettings.setAsNoteMathLink) newHeadLines.push(`> %% main %%`);

            newLines.splice(block.$position.start + lineAdded, 1, ...newHeadLines);

            lineAdded += newHeadLines.length - 1;
        }
    }

    return newLines.join('\n');
} 

export function generateTheoremCalloutFirstLine(config: TheoremCalloutSettings): string {
    const metadata = config.number === 'auto' ? '' : config.number === '' ? '|*' : `|${config.number}`;
    let firstLine = `> [!${config.type}${metadata}]${config.fold ?? ''}${config.title ? ' ' + config.title : ''}`
    if (config.label) firstLine += `\n> %% label: ${config.label} %%`;
    return firstLine;
}

export function insertTheoremCalloutCallback(editor: Editor, config: TheoremCalloutSettings): void {
    const selection = editor.getSelection();
    const cursorPos = editor.getCursor();

    const firstLine = generateTheoremCalloutFirstLine(config);

    if (selection) {
        const nLines = splitIntoLines(selection).length;
        editor.replaceSelection(firstLine + '\n' + increaseQuoteLevel(selection));
        cursorPos.line += nLines;
    } else {
        editor.replaceRange(firstLine + '\n> ', cursorPos)
        cursorPos.line += 1;
    }

    if (config.label) cursorPos.line += 1;
    cursorPos.ch = 2;
    editor.setCursor(cursorPos);
}
