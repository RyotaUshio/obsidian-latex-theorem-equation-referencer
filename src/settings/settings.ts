import { Modifier } from "obsidian";
import { DEFAULT_PROFILES, Profile } from "./profile";
import { LeafArgs } from "type";


export const NUMBER_STYLES = [
    "arabic",
    "alph",
    "Alph",
    "roman",
    "Roman"
] as const;
export type NumberStyle = typeof NUMBER_STYLES[number];

export const MATH_CALLOUT_STYLES = [
    "Custom", 
    "Plain",
    "Framed",
    "MathWiki",
    "Vivid",
] as const;
export type MathCalloutStyle = typeof MATH_CALLOUT_STYLES[number];

export const MATH_CALLOUT_REF_FORMATS = [
    "Type + number (+ title)", 
    "Type + number", 
    "Only title if exists, type + number otherwise"
] as const;
export type MathCalloutRefFormat = typeof MATH_CALLOUT_REF_FORMATS[number];

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

// Context settings are called "local settings" in the documentation and UI.
// Sorry for confusion, this is due to a historical reason. I'll fix it later.
export interface MathContextSettings {
    profile: string;
    titleSuffix: string;
    numberPrefix: string;
    numberSuffix: string;
    numberInit: number;
    numberStyle: NumberStyle;
    numberDefault: string;
    refFormat: MathCalloutRefFormat;
    noteMathLinkFormat: MathCalloutRefFormat;
    eqNumberPrefix: string;
    eqNumberSuffix: string;
    eqNumberInit: number;
    eqNumberStyle: NumberStyle;
    eqRefPrefix: string;
    eqRefSuffix: string;
    labelPrefix: string;
    lineByLine: boolean;
    mathCalloutStyle: MathCalloutStyle;
    mathCalloutFontInherit: boolean;
    beginProof: string;
    endProof: string;
    insertSpace: boolean;
}

export interface MathCalloutSettings {
    type: string;
    number: string;
    title?: string;
    label?: string;
    setAsNoteMathLink: boolean;
}

export interface MathCalloutPrivateFields {
    _index?: number;
}

export interface ExtraSettings {
    noteTitleInLink: boolean;
    profiles: Record<string, Profile>;
    triggerSuggest: string;
    triggerTheoremSuggest: string;
    triggerEquationSuggest: string;
    renderMathInSuggestion: boolean;
    searchMethod: "Fuzzy" | "Simple";
    upWeightRecent: number;
    searchOnlyRecent: boolean;
    modifierToJump: Modifier;
    suggestLeafOption: LeafOption;
    backlinkLeafOption: LeafOption;
}

export type MathSettings = Partial<MathContextSettings> & MathCalloutSettings & MathCalloutPrivateFields;
export type ResolvedMathSettings = Required<MathContextSettings> & MathCalloutSettings & MathCalloutPrivateFields;

export const DEFAULT_SETTINGS: Required<MathContextSettings> = {
    profile: Object.keys(DEFAULT_PROFILES)[0],
    titleSuffix: ".",
    numberPrefix: "",
    numberSuffix: "",
    numberInit: 1,
    numberStyle: "arabic",
    numberDefault: "auto", 
    refFormat: "Type + number (+ title)",
    noteMathLinkFormat: "Type + number (+ title)",
    eqNumberPrefix: "",
    eqNumberSuffix: "",
    eqNumberInit: 1,
    eqNumberStyle: "arabic",
    eqRefPrefix: "", 
    eqRefSuffix: "",
    labelPrefix: "",
    lineByLine: true,
    mathCalloutStyle: "Framed",
    mathCalloutFontInherit: false,
    beginProof: "\\begin{proof}",
    endProof: "\\end{proof}",
    insertSpace: true,
}

export const DEFAULT_EXTRA_SETTINGS: Required<ExtraSettings> = {
    noteTitleInLink: true,
    profiles: DEFAULT_PROFILES,
    triggerSuggest: "\\ref",
    triggerTheoremSuggest: "\\tref",
    triggerEquationSuggest: "\\eqref",
    renderMathInSuggestion: true,
    searchMethod: "Fuzzy",
    upWeightRecent: 0.1, 
    searchOnlyRecent: false,
    modifierToJump: "Mod",
    suggestLeafOption: "Split right", 
    backlinkLeafOption: "Split right", 
};
