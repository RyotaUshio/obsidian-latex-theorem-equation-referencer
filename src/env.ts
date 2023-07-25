// import { THEOREM_LIKE_ENV_IDs } from './env';
// Mathematical environments, such as definitions, theorems, proofs, and so on.

import LanguageManager from './language';


export const NON_THEOREM_LIKE_ENV_IDs = [
    "proof", 
    "solution",
] as const;


export const THEOREM_LIKE_ENV_IDs = [
    "lemma", 
    "proposition", 
    "theorem",
    "corollary",
    "definition",
    "claim", 
    "assumption",
    "example",
    "exercise",
    "conjecture",
    "hypothesis",
] as const;

export const ENV_IDs = [...THEOREM_LIKE_ENV_IDs, ...NON_THEOREM_LIKE_ENV_IDs, ] as const;

export type ENV_ID = typeof ENV_IDs[number];
export type THEOREM_LIKE_ENV_ID = typeof THEOREM_LIKE_ENV_IDs[number];

export class Env {
    public printedNames: Record<string, string>;

    constructor(
        public id: ENV_ID,
        printedNames: Record<string, string>
    ) {
        this.printedNames = {};
        this.name(printedNames);
    };

    name(langNamePairs: Record<string, string>) {
        for (let lang in langNamePairs) {
            LanguageManager.assert(lang);
            this.printedNames[lang] = langNamePairs[lang];
        }
    }
}

export const PROOF = new Env('proof', { ja: '証明', en: 'Proof' });
export const SOLUTION = new Env('solution', { ja: '解答', en: 'Solution' });


export class TheoremLikeEnv extends Env {
    constructor(
        public id: THEOREM_LIKE_ENV_ID,
        public printedNames: Record<string, string>,
        public prefix: string,
        public proofEnv?: Env
    ) {
        super(id, printedNames);
    }

    match(key: string): boolean {
        key = key.toLowerCase();
        for (let prop of [this.id, this.prefix]) {
            if (key == prop.toLowerCase()) {
                return true;
            }
        }
        for (let lang in this.printedNames) {
            let name = this.printedNames[lang].toLowerCase();
            if (key == name) {
                return true;
            }
        }
        return false;
    }
}




export const ENVs = [
    new TheoremLikeEnv(
        "lemma",
        { ja: "補題", en: "Lemma" },
        "lem",
        PROOF,
    ),
    new TheoremLikeEnv(
        "proposition",
        { ja: "命題", en: "Proposition" },
        "prop",
        PROOF,
    ),
    new TheoremLikeEnv(
        "theorem",
        { ja: "定理", en: "Theorem" },
        "thm",
        PROOF,
    ),
    new TheoremLikeEnv(
        "corollary",
        { ja: "系", en: "Corollary" },
        "cor",
        PROOF,
    ),
    new TheoremLikeEnv(
        "definition",
        { ja: "定義", en: "Definition" },
        "def",
    ),
    // Note prefix=that cl id=aim is not supported by Bookdownw
    new TheoremLikeEnv(
        "claim",
        { ja: "主張", en: "Claim" },
        "clm",
        PROOF,
    ),
    // Note prefix=that as id=sumption is not supported by Bookdownw
    new TheoremLikeEnv(
        "assumption",
        { ja: "仮定", en: "Assumption" },
        "ass",
    ),
    new TheoremLikeEnv(
        "example",
        { ja: "例", en: "Example" },
        "exm",
        PROOF,
    ),
    new TheoremLikeEnv(
        "exercise",
        { ja: "演習問題", en: "Exercise" },
        "exr",
        SOLUTION,
    ),
    new TheoremLikeEnv(
        "conjecture",
        { ja: "予想", en: "Conjecture" },
        "cnj",
    ),
    new TheoremLikeEnv(
        "hypothesis",
        { ja: "仮説", en: "Hypothesis" },
        "hyp",
    )
]




export function getTheoremLikeEnv(key: string): TheoremLikeEnv {
    let result = ENVs.find((env) => env.match(key));
    // for (const env of ENVs) {
    //     if (env.match(key)) {
    //         return env;
    //     }
    // }
    if (result) {
        return result;
    }
    throw Error(`Invalid theorem.type = ${key}`);
}
