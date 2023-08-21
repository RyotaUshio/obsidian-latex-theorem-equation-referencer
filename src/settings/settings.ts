import { DEFAULT_PROFILES, Profile } from "../profile";


export const NUMBER_STYLES = [
    "arabic",
    "alph",
    "Alph",
    "roman",
    "Roman"
] as const;
export type NumberStyle = typeof NUMBER_STYLES[number];

export const MATH_CALLOUT_STYLES = [
    "custom", 
    "plain",
    "framed",
    "mathwiki",
    "vivid",
] as const;
export type MathCalloutStyle = typeof MATH_CALLOUT_STYLES[number];

export const MATH_CALLOUT_REF_FORMATS = [
    "Type + number (+ title)", 
    "Type + number", 
    "Only title if exists, type + number otherwise"
] as const;
export type MathCalloutRefFormat = typeof MATH_CALLOUT_REF_FORMATS[number];

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
    beginProofReplace: string;
    endProofReplace: string;
    linkedBeginProofPrefix: string;
    linkedBeginProofSuffix: string;
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
    mathCalloutStyle: "framed",
    mathCalloutFontInherit: false,
    beginProof: "\\begin{proof}",
    endProof: "\\end{proof}",
    beginProofReplace: "Proof.",
    endProofReplace: "□",
    linkedBeginProofPrefix: "Proof of ",
    linkedBeginProofSuffix: ".",
}

export const DEFAULT_EXTRA_SETTINGS: Required<ExtraSettings> = {
    noteTitleInLink: true,
    profiles: DEFAULT_PROFILES,
};
