import { ENV_IDs } from "../env";
import { DEFAULT_LANG } from "../default_lang";


export type NumberStyle = "arabic" | "alph" | "Alph" | "roman" | "Roman";

export type RenameEnv = { [K in typeof ENV_IDs[number]]: string };

export interface MathContextSettings {
    lang?: string;
    titleSuffix?: string;
    numberPrefix?: string;
    numberSuffix?: string;
    numberInit?: number;
    numberStyle?: NumberStyle;
    numberDefault?: string;
    eqNumberStyle?: NumberStyle;
    labelPrefix?: string;
    rename?: RenameEnv;
    preamblePath?: string;
    lineByLine?: boolean;
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
export type CalloutSettings = MathSettings;

export const MATH_CONTXT_SETTINGS_KEYS = [
    "lang",
    "titleSuffix",
    "numberPrefix",
    "numberSuffix",
    "numberInit",
    "numberStyle",
    "numberDefault",
    "eqNumberStyle",
    "labelPrefix",
    "rename",
    "preamblePath",
    "lineByLine",
]

export const MATH_ITEM_SETTINGS_KEYS = [
    "type",
    "number",
    "title",
    "label",
]

export const MATH_ITEM_PRIVATE_FIELDS_KEYS = [
    "_index",
]

export const MATH_SETTINGS_KEYS = [
    ...MATH_CONTXT_SETTINGS_KEYS,
    ...MATH_ITEM_SETTINGS_KEYS,
    ...MATH_ITEM_PRIVATE_FIELDS_KEYS
]

export const DEFAULT_SETTINGS = {
    lang: DEFAULT_LANG,
    titleSuffix: ".",
    numberPrefix: "",
    numberSuffix: "",
    numberInit: 1,
    numberStyle: "arabic",
    numberDefault: "auto", 
    eqNumberStyle: "arabic",
    labelPrefix: "",
    rename: {} as RenameEnv,
    preamblePath: "",
    lineByLine: true,
}
