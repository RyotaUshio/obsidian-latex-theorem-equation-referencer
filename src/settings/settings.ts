import { ENV_IDs } from "../env";
import { DEFAULT_LANG } from "../default_lang";


export const NUMBER_STYLES = [
    "arabic",
    "alph",
    "Alph",
    "roman",
    "Roman"
] as const;
export type NumberStyle = typeof NUMBER_STYLES[number];

export type RenameEnv = { [K in typeof ENV_IDs[number]]: string };

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

export interface MathContextSettings {
    lang?: string;
    titleSuffix?: string;
    numberPrefix?: string;
    numberSuffix?: string;
    numberInit?: number;
    numberStyle?: NumberStyle;
    numberDefault?: string;
    refFormat?: MathCalloutRefFormat;
    eqNumberPrefix?: string;
    eqNumberSuffix?: string;
    eqNumberInit?: number;
    eqNumberStyle?: NumberStyle;
    labelPrefix?: string;
    rename?: RenameEnv;
    lineByLine?: boolean;
    mathCalloutStyle?: MathCalloutStyle;
    mathCalloutFontInherit?: boolean;
}

export interface MathCalloutSettings {
    type: string;
    number?: string;
    title?: string;
    label?: string;
}

export interface MathCalloutPrivateFields {
    _index?: number;
}

export type MathSettings = MathContextSettings & MathCalloutSettings & MathCalloutPrivateFields;

export const DEFAULT_SETTINGS: Required<MathContextSettings> = {
    lang: DEFAULT_LANG,
    titleSuffix: ".",
    numberPrefix: "",
    numberSuffix: "",
    numberInit: 1,
    numberStyle: "arabic",
    numberDefault: "auto", 
    refFormat: "Type + number (+ title)",
    eqNumberPrefix: "",
    eqNumberSuffix: "",
    eqNumberInit: 1,
    eqNumberStyle: "arabic",
    labelPrefix: "",
    rename: {} as RenameEnv,
    lineByLine: true,
    mathCalloutStyle: "framed",
    mathCalloutFontInherit: false,
}
