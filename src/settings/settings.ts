import { Modifier } from "obsidian";

import { DEFAULT_PROFILES, Profile } from "./profile";
import { LeafArgs } from "../typings/type";
import { QueryType } from "search/core";
import { SearchRange } from "search/modal";

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
    "Current tab",
    "Split right",
    "Split down", 
    "New tab", 
    "New window",
] as const;
export type LeafOption = typeof LEAF_OPTIONS[number];
export const LEAF_OPTION_TO_ARGS: Record<LeafOption, LeafArgs> = {
    "Current tab": [false],
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
    showTheoremTitleinBuiltin: boolean;
    renderEquationinBuiltin: boolean;
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
    searchLabel: boolean;
    modifierToJump: Modifier;
    modifierToNoteLink: Modifier;
    showModifierInstruction: boolean;
    suggestLeafOption: LeafOption;
    // projectInfix: string;
    // projectSep: string;
    showTheoremCalloutEditButton: boolean;
    setOnlyTheoremAsMain: boolean;
    setLabelInModal: boolean;
    excludeExampleCallout: boolean;
    enableProof: boolean;
    enableMathPreviewInCalloutAndQuote: boolean;
    // searchModal*: not congigurable from the setting tab, just remenbers the last state
    searchModalQueryType: QueryType;
    searchModalRange: SearchRange;
    searchModalDvQuery: string;
}

export const UNION_TYPE_EXTRA_SETTING_KEYS: {[k in keyof Partial<ExtraSettings>]: readonly string[]} = {
    "searchMethod": SEARCH_METHODS,
    "suggestLeafOption": LEAF_OPTIONS,
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
    noteMathLinkFormat: "[title] if title exists, [type] [number] otherwise",
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
    showTheoremTitleinBuiltin: true,
    renderEquationinBuiltin: true,
    triggerSuggest: "\\ref",
    triggerTheoremSuggest: "\\tref",
    triggerEquationSuggest: "\\eqref",
    triggerSuggestActiveNote: "\\rea",
    triggerTheoremSuggestActiveNote: "\\trea",
    triggerEquationSuggestActiveNote: "\\eqrea",
    triggerSuggestRecentNotes: "\\rer",
    triggerTheoremSuggestRecentNotes: "\\trer",
    triggerEquationSuggestRecentNotes: "\\eqrer",
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
    searchLabel: false,
    modifierToJump: "Mod",
    modifierToNoteLink: "Shift",
    showModifierInstruction: true,
    suggestLeafOption: "Current tab", 
    // projectInfix: " > ",
    // projectSep: "/",
    importerNumThreads: 2,
    importerUtilization: 0.75,
    showTheoremCalloutEditButton: false,
    setOnlyTheoremAsMain: false,
    setLabelInModal: false,
    excludeExampleCallout: false,
    enableProof: true,
    enableMathPreviewInCalloutAndQuote: true,
    searchModalQueryType: 'both',
    searchModalRange: 'recent',
    searchModalDvQuery: '',
};
