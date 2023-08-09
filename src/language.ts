import { DEFAULT_LANG } from './default_lang';

export default class LanguageManager {
    static default: string = DEFAULT_LANG;
    static supported: Array<string> = ['en', 'ja'];
    
    static supports(lang: string): boolean {
        return LanguageManager.supported.includes(lang);
    }

    static assert(lang: string) {
        if (!LanguageManager.supports(lang)) {
            throw Error(`Unsupported language: ${lang}`);
        }
    }

    static addSupport(lang: string) {
        LanguageManager.supported.push(lang);
    }

    static validate(lang: string | undefined): string {
        if (typeof lang == "string") {
            LanguageManager.assert(lang);
            return lang;
        }   
        return LanguageManager.default;
    }
}
