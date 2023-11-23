import { App, TFile } from "obsidian";

import MathBooster from "main";
import { getPropertyOrLinkTextInProperty } from "utils/obsidian";
import { DEFAULT_SETTINGS, MathContextSettings, NumberStyle, ResolvedMathSettings } from "settings/settings";
import { THEOREM_LIKE_ENVs, TheoremLikeEnvID } from "env";


const ROMAN = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
    "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
    "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

export function toRomanUpper(num: number): string {
    // https://stackoverflow.com/a/9083076/13613783
    const digits = String(num).split("");
    let roman = "";
    let i = 3;
    while (i--) {
        // @ts-ignore
        roman = (ROMAN[+digits.pop() + (i * 10)] ?? "") + roman;
    }
    return Array(+digits.join("") + 1).join("M") + roman;
}

export function toRomanLower(num: number): string {
    return toRomanUpper(num).toLowerCase();
}

export const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function toAlphUpper(num: number): string {
    return (num - 1).toString(26).split("").map(str => ALPH[parseInt(str, 26)]).join("");
}

export function toAlphLower(num: number): string {
    return toAlphUpper(num).toLowerCase();
}

export const CONVERTER = {
    "arabic": String,
    "alph": toAlphLower,
    "Alph": toAlphUpper,
    "roman": toRomanLower,
    "Roman": toRomanUpper,
}

export function formatTheoremCalloutType(plugin: MathBooster, settings: { type: string, profile: string }): string {
    const profile = plugin.extraSettings.profiles[settings.profile];
    return profile.body.theorem[settings.type as TheoremLikeEnvID];
}

export function formatTitleWithoutSubtitle(plugin: MathBooster, file: TFile, settings: ResolvedMathSettings): string {
    let title = formatTheoremCalloutType(plugin, settings);

    if (settings.number) {
        if (settings.number == 'auto') {
            if (settings._index !== undefined) {
                settings.numberInit = settings.numberInit ?? 1;
                const num = +settings._index + +settings.numberInit;
                const style = settings.numberStyle ?? DEFAULT_SETTINGS.numberStyle as NumberStyle;
                title += ` ${getNumberPrefix(plugin.app, file, settings)}${CONVERTER[style](num)}${settings.numberSuffix}`;
            }
        } else {
            title += ` ${settings.number}`;
        }
    }
    return title;
}

export function formatTitle(plugin: MathBooster, file: TFile, settings: ResolvedMathSettings, noTitleSuffix: boolean = false): string {
    let title = formatTitleWithoutSubtitle(plugin, file, settings);
    return addSubTitle(title, settings, noTitleSuffix);
}

export function addSubTitle(mainTitle: string, settings: ResolvedMathSettings, noTitleSuffix: boolean = false) {
    let title = mainTitle;
    if (settings.title) {
        title += ` (${settings.title})`;
    }
    if (!noTitleSuffix && settings.titleSuffix) {
        title += settings.titleSuffix;
    }
    return title;
}

export function inferNumberPrefix(source: string, regExp: string): string | undefined {
    const pattern = new RegExp(regExp);
    const match = source.match(pattern);
    if (match) {
        let prefix = match[0].trim();
        if (!prefix.endsWith('.')) prefix += '.';
        return prefix;
    }
}

// /**
//  * "A note about calculus" => The "A" at the head shouldn't be used as a prefix (indefinite article)
//  * "A. note about calculus" => The "A" at the head IS a prefix
//  */
// export function areValidLabels(labels: string[]): boolean {
//     function isValidLabel(label: string): boolean { // true if every label is an arabic or roman numeral
//         if (label.match(/^[0-9]+$/)) {
//             // Arabic numerals
//             return true;
//         }
//         if (label.match(/^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i)) {
//             // Roman numerals
//             // Reference: https://stackoverflow.com/a/267405/13613783
//             return true;
//         }
//         if (label.match(/^[a-z]$/i)) {
//             return true;
//         }
//         return false;
//     }
//     const blankRemoved = labels.filter((label) => label);
//     if (blankRemoved.length >= 2) {
//         return blankRemoved.every((label) => isValidLabel(label));
//     }
//     if (blankRemoved.length == 1) {
//         return labels.length == 2 && (isValidLabel(labels[0]));
//     }
//     return false;
// }

/**
 * Get an appropriate prefix for theorem callout numbering.
 * @param file 
 * @param settings 
 * @returns 
 */
export function getNumberPrefix(app: App, file: TFile, settings: Required<MathContextSettings>): string {
    if (settings.numberPrefix) {
        return settings.numberPrefix;
    }
    const source = settings.inferNumberPrefixFromProperty ? getPropertyOrLinkTextInProperty(app, file, settings.inferNumberPrefixFromProperty) : file.basename;
    if (settings.inferNumberPrefix && source) {
        return inferNumberPrefix(
            source,
            settings.inferNumberPrefixRegExp
        ) ?? "";
    }
    return "";
}

/**
 * Get an appropriate prefix for equation numbering.
 * @param file 
 * @param settings 
 * @returns 
 */
export function getEqNumberPrefix(app: App, file: TFile, settings: Required<MathContextSettings>): string {
    if (settings.eqNumberPrefix) {
        return settings.eqNumberPrefix;
    }
    const source = settings.inferEqNumberPrefixFromProperty ? getPropertyOrLinkTextInProperty(app, file, settings.inferEqNumberPrefixFromProperty) : file.basename;
    if (settings.inferEqNumberPrefix && source) {
        const prefix = inferNumberPrefix(
            source,
            settings.inferEqNumberPrefixRegExp
        ) ?? "";
        console.log({source, prefix});
        return prefix;
    }
    return "";
}

export function formatLabel(settings: ResolvedMathSettings): string | undefined {
    if (settings.label) {
        return settings.labelPrefix + THEOREM_LIKE_ENVs[settings.type as TheoremLikeEnvID].prefix + ":" + settings.label;
    }
}
