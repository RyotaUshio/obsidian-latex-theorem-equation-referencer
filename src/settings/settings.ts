import { ENV_IDs } from "../env";
import { DEFAULT_LANG } from "../default_lang";


export type NumberStyle = "arabic" | "alph" | "Alph" | "roman" | "Roman";

export type RenameEnv = { [K in typeof ENV_IDs[number]]: string };

export interface MathContextSettings {
    lang?: string;
    number_prefix?: string;
    number_suffix?: string;
    number_init?: number;
    number_style?: NumberStyle;
    eq_number_style?: NumberStyle;
    label_prefix?: string;
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
    "number_prefix",
    "number_suffix",
    "number_init",
    "number_style",
    "eq_number_style",
    "label_prefix",
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
    number_prefix: "",
    number_suffix: "",
    number_init: 1,
    number_style: "arabic",
    eq_number_style: "arabic",
    label_prefix: "",
    rename: {} as RenameEnv,
    preamblePath: "",
    lineByLine: true,
}
