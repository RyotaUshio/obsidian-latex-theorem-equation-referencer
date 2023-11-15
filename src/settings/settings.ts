import { Modifier } from "obsidian";

import { DEFAULT_PROFILES, Profile } from "./profile";
import { LeafArgs } from "../typings/type";

// Types

export const NUMBER_STYLES = [
    "arabic",
    "alph",
    "Alph",
    "roman",
    "Roman"
] as const;
export type NumberStyle = typeof NUMBER_STYLES[number];

export const THEOREM_CALLOUT_STYLES = [
    "Custom", 
    "Plain",
    "Framed",
    "MathWiki",
    "Vivid",
] as const;
export type TheoremCalloutStyle = typeof THEOREM_CALLOUT_STYLES[number];

export const THEOREM_REF_FORMATS = [
    "[type] [number] ([title])", 
    "[type] [number]", 
    "[title] ([type] [number]) if title exists, [type] [number] otherwise",
    "[title] if title exists, [type] [number] otherwise",
] as const;
export type TheoremRefFormat = typeof THEOREM_REF_FORMATS[number];

export const LEAF_OPTIONS = [
    "Split right",
    "Split down", 
    "New tab", 
    "New window",
] as const;
export type LeafOption = typeof LEAF_OPTIONS[number];
export const LEAF_OPTION_TO_ARGS: Record<LeafOption, LeafArgs> = {
    "Split right": ["split", "vertical"],
    "Split down": ["split", "horizontal"],
    "New tab": ["tab"], 
    "New window": ["window"], 
}

export const SEARCH_METHODS = [
    "Fuzzy",
    "Simple"
] as const;
export type SearchMethod = typeof SEARCH_METHODS[number];


// Context settings are called "local settings" in the documentation and UI.
// Sorry for confusion, this is due to a historical reason. I'll fix it later.
export interface MathContextSettings {
    profile: string;
    titleSuffix: string;
    inferNumberPrefix: boolean;
    inferNumberPrefixFromProperty: string;
    inferNumberPrefixParseSep: string;
    inferNumberPrefixPrintSep: string;
    inferNumberPrefixUseFirstN: number;
    numberPrefix: string;
    numberSuffix: string;
    numberInit: number;
    numberStyle: NumberStyle;
    numberDefault: string;
    refFormat: TheoremRefFormat;
    noteMathLinkFormat: TheoremRefFormat;
    inferEqNumberPrefix: boolean;
    inferEqNumberPrefixFromProperty: string;
    inferEqNumberPrefixParseSep: string;
    inferEqNumberPrefixPrintSep: string;
    inferEqNumberPrefixUseFirstN: number;
    eqNumberPrefix: string;
    eqNumberSuffix: string;
    eqNumberInit: number;
    eqNumberStyle: NumberStyle;
    eqRefPrefix: string;
    eqRefSuffix: string;
    labelPrefix: string;
    lineByLine: boolean;
    theoremCalloutStyle: TheoremCalloutStyle;
    theoremCalloutFontInherit: boolean;
    beginProof: string;
    endProof: string;
    insertSpace: boolean;
}

export const UNION_TYPE_MATH_CONTEXT_SETTING_KEYS: {[k in keyof Partial<MathContextSettings>]: readonly string[]} = {
    "numberStyle": NUMBER_STYLES,
    "refFormat": THEOREM_REF_FORMATS,
    "noteMathLinkFormat": THEOREM_REF_FORMATS,
    "eqNumberStyle": NUMBER_STYLES,
    "theoremCalloutStyle": THEOREM_CALLOUT_STYLES,
};

export type FoldOption = '' | '+' | '-';

export type MinimalTheoremCalloutSettings = {
    type: string;
    number: string;
    title?: string;
    fold?: FoldOption;
}

export type TheoremCalloutSettings = MinimalTheoremCalloutSettings & {
    // type: string;
    // number: string;
    // title?: string;
    label?: string;
    // setAsNoteMathLink: boolean;
}

export interface TheoremCalloutPrivateFields {
    _index?: number;
}

export interface ImporterSettings {
    importerNumThreads: number;
    importerUtilization: number;
}

export type ExtraSettings = ImporterSettings & {
    foldDefault: FoldOption;
    noteTitleInLink: boolean;
    profiles: Record<string, Profile>;
    triggerSuggest: string;
    triggerTheoremSuggest: string;
    triggerEquationSuggest: string;
    triggerSuggestActiveNote: string;
    triggerTheoremSuggestActiveNote: string;
    triggerEquationSuggestActiveNote: string;
    triggerSuggestRecentNotes: string;
    triggerTheoremSuggestRecentNotes: string;
    triggerEquationSuggestRecentNotes: string;
    enableSuggest: boolean;
    enableTheoremSuggest: boolean;
    enableEquationSuggest: boolean;
    enableSuggestActiveNote: boolean;
    enableTheoremSuggestActiveNote: boolean;
    enableEquationSuggestActiveNote: boolean;
    enableSuggestRecentNotes: boolean;
    enableTheoremSuggestRecentNotes: boolean;
    enableEquationSuggestRecentNotes: boolean;
    renderMathInSuggestion: boolean;
    suggestNumber: number;
    searchMethod: SearchMethod;
    upWeightRecent: number;
    // searchOnlyRecent: boolean;
    searchTags: boolean;
    searchLabel: boolean;
    modifierToJump: Modifier;
    modifierToNoteLink: Modifier;
    showModifierInstruction: boolean;
    suggestLeafOption: LeafOption;
    backlinkLeafOption: LeafOption;
    // projectInfix: string;
    // projectSep: string;
    showTheoremCalloutEditButton: boolean;
}

export const UNION_TYPE_EXTRA_SETTING_KEYS: {[k in keyof Partial<ExtraSettings>]: readonly string[]} = {
    "searchMethod": SEARCH_METHODS,
    "suggestLeafOption": LEAF_OPTIONS,
    "backlinkLeafOption": LEAF_OPTIONS,
};

export type MathSettings = Partial<MathContextSettings> & TheoremCalloutSettings & TheoremCalloutPrivateFields;
export type ResolvedMathSettings = Required<MathContextSettings> & TheoremCalloutSettings & TheoremCalloutPrivateFields;

export const DEFAULT_SETTINGS: Required<MathContextSettings> = {
    profile: Object.keys(DEFAULT_PROFILES)[0],
    titleSuffix: ".",
    inferNumberPrefix: true,
    inferNumberPrefixFromProperty: "",
    inferNumberPrefixParseSep: "-.",
    inferNumberPrefixPrintSep: ".",
    inferNumberPrefixUseFirstN: 1,
    numberPrefix: "",
    numberSuffix: "",
    numberInit: 1,
    numberStyle: "arabic",
    numberDefault: "auto", 
    refFormat: "[type] [number] ([title])",
    noteMathLinkFormat: "[type] [number] ([title])",
    inferEqNumberPrefix: true,
    inferEqNumberPrefixFromProperty: "",
    inferEqNumberPrefixParseSep: "-.",
    inferEqNumberPrefixPrintSep: ".",
    inferEqNumberPrefixUseFirstN: 1,
    eqNumberPrefix: "",
    eqNumberSuffix: "",
    eqNumberInit: 1,
    eqNumberStyle: "arabic",
    eqRefPrefix: "", 
    eqRefSuffix: "",
    labelPrefix: "",
    lineByLine: true,
    theoremCalloutStyle: "Framed",
    theoremCalloutFontInherit: false,
    beginProof: "\\begin{proof}",
    endProof: "\\end{proof}",
    insertSpace: true,
}

export const DEFAULT_EXTRA_SETTINGS: Required<ExtraSettings> = {
    foldDefault: '',
    noteTitleInLink: true,
    profiles: DEFAULT_PROFILES,
    triggerSuggest: "\\ref",
    triggerTheoremSuggest: "\\tref",
    triggerEquationSuggest: "\\eqref",
    triggerSuggestActiveNote: "\\rea",
    triggerTheoremSuggestActiveNote: "\\eqrea",
    triggerEquationSuggestActiveNote: "\\trea",
    triggerSuggestRecentNotes: "\\rer",
    triggerTheoremSuggestRecentNotes: "\\eqrer",
    triggerEquationSuggestRecentNotes: "\\trer",
    enableSuggest: true,
    enableTheoremSuggest: true,
    enableEquationSuggest: true,
    enableSuggestActiveNote: true,
    enableTheoremSuggestActiveNote: true,
    enableEquationSuggestActiveNote: true,
    enableSuggestRecentNotes: true,
    enableTheoremSuggestRecentNotes: true,
    enableEquationSuggestRecentNotes: true,
    renderMathInSuggestion: true,
    suggestNumber: 20,
    searchMethod: "Fuzzy",
    upWeightRecent: 0.1, 
    // searchOnlyRecent: false,
    searchTags: false,
    searchLabel: false,
    modifierToJump: "Mod",
    modifierToNoteLink: "Shift",
    showModifierInstruction: true,
    suggestLeafOption: "Split right", 
    backlinkLeafOption: "Split right",
    // projectInfix: " > ",
    // projectSep: "/",
    importerNumThreads: 2,
    importerUtilization: 0.75,
    showTheoremCalloutEditButton: false,
};
