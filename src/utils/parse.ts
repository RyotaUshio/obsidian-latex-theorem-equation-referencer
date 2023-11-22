import { THEOREM_LIKE_ENV_IDs, THEOREM_LIKE_ENV_PREFIXES, THEOREM_LIKE_ENV_PREFIX_ID_MAP, TheoremLikeEnvID, TheoremLikeEnvPrefix } from "env";
import { FoldOption, MinimalTheoremCalloutSettings } from "settings/settings";

export const THEOREM_CALLOUT_PATTERN = new RegExp(
    `> *\\[\\! *(?<type>${THEOREM_LIKE_ENV_IDs.join('|')}|${THEOREM_LIKE_ENV_PREFIXES.join('|')}|math) *(\\|(?<number>.*?))?\\](?<fold>[+-])?(?<title> .*)?`,
    'i'
);

export function matchTheoremCallout(line: string): RegExpExecArray | null {
    return THEOREM_CALLOUT_PATTERN.exec(line)
}

/** > [!type|HERE IS METADATA] 
 * a.k.a the "data-callout-metadata" attribute
 */
export function parseTheoremCalloutMetadata(metadata: string) {
    let number = metadata.trim();
    if (!number) number = 'auto';
    else if (number === '*') number = '';
    return number;
}

/**
 * 
 * @param line 
 * @param excludeExample if true, then ""> [!example]" will not be treated as a theorem callout but as the built-in example callout.
 * @returns 
 */
export function readTheoremCalloutSettings(line: string, excludeExample: boolean = false): MinimalTheoremCalloutSettings & { legacy: boolean } | undefined {
    const rawSettings = line.match(THEOREM_CALLOUT_PATTERN)?.groups as { type: string, number?: string, title?: string, fold?: string } | undefined;
    if (!rawSettings) return;

    let type = rawSettings.type.trim().toLowerCase();

    // TODO: rewrite using _readTheoremCalloutSettings

    if (type === 'math' && rawSettings.number) {
        // legacy format
        const settings = JSON.parse(rawSettings.number) as MinimalTheoremCalloutSettings & { legacy: boolean };
        settings.legacy = true;
        return settings;
    }

    // new format
    if (excludeExample && type === 'example') return undefined;

    if (type.length <= 4) { // use length to avoid iterating over all the prefixes
        // convert a prefix to an ID (e.g. "thm" -> "theorem")
        type = THEOREM_LIKE_ENV_PREFIX_ID_MAP[type as TheoremLikeEnvPrefix];
    }
    const number = parseTheoremCalloutMetadata(rawSettings.number ?? '');

    let title: string | undefined = rawSettings.title?.trim();
    if (title === '') title = undefined;

    const fold = (rawSettings.fold?.trim() ?? '') as FoldOption;

    return { type, number, title, fold, legacy: false };
}

export function _readTheoremCalloutSettings(callout: {type: string, metadata: string}, excludeExample: boolean = false): { type: string, number: string, legacy: boolean } | undefined {
    let type = callout.type;

    if (callout.type === 'math' && callout.metadata) {
        // legacy format
        const settings = JSON.parse(callout.metadata) as MinimalTheoremCalloutSettings & { legacy: boolean };
        settings.legacy = true;
        return settings;
    }

    // new format
    if (excludeExample && callout.type === 'example') return undefined;

    if (callout.type.length <= 4) { // use length to avoid iterating over all the prefixes
        // convert a prefix to an ID (e.g. "thm" -> "theorem")
        type = THEOREM_LIKE_ENV_PREFIX_ID_MAP[callout.type as TheoremLikeEnvPrefix];
    }
    const number = parseTheoremCalloutMetadata(callout.metadata);

    return { type, number, legacy: false };
}


export function trimMathText(text: string) {
    return text.match(/\$\$([\s\S]*)\$\$/)?.[1].trim() ?? text;
}

export function parseLatexComment(line: string): { nonComment: string, comment: string } {
    const match = line.match(/(?<!\\)%/);
    if (match?.index !== undefined) {
        return { nonComment: line.substring(0, match.index), comment: line.substring(match.index + 1) }
    }
    return { nonComment: line, comment: '' };
}

/** Parse the given markdown text and returns all comments in it as an array of lines. */
export function parseMarkdownComment(markdown: string): string[] {
    const comments: string[] = [];
    const pattern = /%%([\s\S]*?)%%/g;
    let result;
    while (result = pattern.exec(markdown)) {
        for (let line of result[1].split('\n')) {
            line = line.trim();
            if (line) comments.push(line);
        }
    }
    return comments;
}

/** Parse an one-line YAML-like string into a key-value pair. */
export function parseYamlLike(line: string): Record<string, string | undefined> | null {
    const result = line.match(/^(?<key>.*?):(?<value>.*)$/)?.groups;
    if (!result) return null;
    return { [result.key.trim()]: result.value.trim() };
}
