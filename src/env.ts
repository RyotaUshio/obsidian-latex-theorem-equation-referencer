export const THEOREM_LIKE_ENV_IDs = [
    "axiom",
    "definition",
    "lemma",
    "proposition",
    "theorem",
    "corollary",
    "claim",
    "assumption",
    "example",
    "exercise",
    "conjecture",
    "hypothesis",
    "remark",
] as const;

export const PROOF_LIKE_ENV_IDs = [
    "proof",
    "solution",
] as const;

export const ENV_IDs = [...THEOREM_LIKE_ENV_IDs, ...PROOF_LIKE_ENV_IDs,] as const;

export const THEOREM_LIKE_ENV_PREFIXES = [
    "axm",
    "def",
    "lem",
    "prop",
    "thm",
    "cor",
    "clm",
    "ass",
    "exm",
    "exr",
    "cnj",
    "hyp",
    "rmk",
] as const;

export type TheoremLikeEnvID = typeof THEOREM_LIKE_ENV_IDs[number];
export type TheoremLikeEnvPrefix = typeof THEOREM_LIKE_ENV_PREFIXES[number];

export interface TheoremLikeEnv {
    id: TheoremLikeEnvID,
    prefix: TheoremLikeEnvPrefix,
}

export const THEOREM_LIKE_ENVs = {} as Record<TheoremLikeEnvID, TheoremLikeEnv>;
THEOREM_LIKE_ENV_IDs.forEach((id, index) => {
    THEOREM_LIKE_ENVs[id] = {id, prefix: THEOREM_LIKE_ENV_PREFIXES[index]};
});
