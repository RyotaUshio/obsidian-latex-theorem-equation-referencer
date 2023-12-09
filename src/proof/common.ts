import { Profile } from "settings/profile";

export function makeProofClasses(which: "begin" | "end", profile: Profile) {
    return [
        "math-booster-" + which + "-proof", // deprecated
        "latex-referencer-" + which + "-proof",
        ...profile.meta.tags.map((tag) => "math-booster-" + which + "-proof-" + tag), // deprecated
        ...profile.meta.tags.map((tag) => "latex-referencer-" + which + "-proof-" + tag)
    ];
}

export function makeProofElement(which: "begin" | "end", profile: Profile) {
    return createSpan({
        text: profile.body.proof[which],
        cls: makeProofClasses(which, profile)
    })
}
