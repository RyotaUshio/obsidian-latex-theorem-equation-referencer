// length must be >= 5
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

// length must be <= 4
export const THEOREM_LIKE_ENV_PREFIXES = [
    "axm",
    "def",
    "lem",
    "prp",
    "thm",
    "cor",
    "clm",
    "asm",
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

export const THEOREM_LIKE_ENV_PREFIX_ID_MAP = {} as Record<TheoremLikeEnvPrefix, TheoremLikeEnvID>;
THEOREM_LIKE_ENV_PREFIXES.forEach((prefix, index) => {
    THEOREM_LIKE_ENV_PREFIX_ID_MAP[prefix] = THEOREM_LIKE_ENV_IDs[index];
});

export const THEOREM_LIKE_ENV_ID_PREFIX_MAP = {} as Record<TheoremLikeEnvID, TheoremLikeEnvPrefix>;
THEOREM_LIKE_ENV_IDs.forEach((id, index) => {
    THEOREM_LIKE_ENV_ID_PREFIX_MAP[id] = THEOREM_LIKE_ENV_PREFIXES[index];
});
