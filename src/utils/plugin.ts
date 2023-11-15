import MathBooster from "main";
import { CachedMetadata, Notice, TAbstractFile, TFile } from "obsidian";
import { DEFAULT_SETTINGS, MathContextSettings, ResolvedMathSettings, TheoremCalloutSettings } from "settings/settings";
import { generateBlockID, getAncestors } from "./obsidian";
import { EquationBlock, MarkdownBlock, MarkdownPage } from "index/typings/markdown";
import { getIO } from "file_io";

export function resolveSettings(settings: TheoremCalloutSettings, plugin: MathBooster, currentFile: TAbstractFile): ResolvedMathSettings;
export function resolveSettings(settings: undefined, plugin: MathBooster, currentFile: TAbstractFile): Required<MathContextSettings>;
export function resolveSettings(settings: TheoremCalloutSettings | undefined, plugin: MathBooster, currentFile: TAbstractFile): Required<MathContextSettings> {
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