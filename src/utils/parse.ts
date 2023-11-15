import { THEOREM_LIKE_ENV_IDs, THEOREM_LIKE_ENV_PREFIXES, THEOREM_LIKE_ENV_PREFIX_ID_MAP, TheoremLikeEnvPrefix } from "env";
import { FoldOption, MinimalTheoremCalloutSettings } from "settings/settings";

export const THEOREM_CALLOUT_PATTERN = new RegExp(
    `> *\\[\\! *(?<type>${THEOREM_LIKE_ENV_IDs.join('|')}|${THEOREM_LIKE_ENV_PREFIXES.join('|')}|math) *(\\|(?<number>.*?))?\\](?<fold>[+-]?) (?<title>.*)`,
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

export function readTheoremCalloutSettings(line: string): MinimalTheoremCalloutSettings & { legacy: boolean } | undefined {
    const rawSettings = line.match(THEOREM_CALLOUT_PATTERN)?.groups as { type: string, number?: string, title: string, fold: string } | undefined;
    if (!rawSettings) return;

    let type = rawSettings.type.trim().toLowerCase();

    if (type === 'math' && rawSettings.number) {
        // legacy format
        const settings = JSON.parse(rawSettings.number) as MinimalTheoremCalloutSettings & { legacy: boolean };
        settings.legacy = true;
        return settings;
    }

    // new format
    if (type.length <= 4) { // use length to avoid iterating over all the prefixes
        // convert a prefix to an ID (e.g. "thm" -> "theorem")
        type = THEOREM_LIKE_ENV_PREFIX_ID_MAP[type as TheoremLikeEnvPrefix];
    }
    // let number = rawSettings.number?.trim();
    // if (!number) number = 'auto';
    // else if (number === '*') number = '';
    const number = parseTheoremCalloutMetadata(rawSettings.number ?? '');

    let title: string | undefined = rawSettings.title.trim();
    if (title === '') title = undefined;

    const fold = rawSettings.fold.trim() as FoldOption;

    return { type, number, title, fold, legacy: false };
}

export function trimMathText(text: string) {
    return text.match(/\$\$([\s\S]*)\$\$/)?.[1].trim() ?? text;
}
