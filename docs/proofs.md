---
layout: page
title: Proofs
---

> See also [this post](https://forum.obsidian.md/t/new-plugin-math-booster-take-mathematical-notes-just-as-in-latex/65089/3?u=ush) on the forum for more information.

Math Booster supports LaTeX-like proof environments.

```markdown
`\begin{proof}`
Lorem ipsum dolor sit amet, consectetur adipiscing elit, ...
`\end{proof}`
```

Proofs can be folded (collapsed) in live preview.

### Custom texts

Use the following syntax to print custom text. 
Any inline markdown syntax can be used, but inline formulas will render with flickering in the live preview.

```markdown
`\begin{proof}[Solution.]`
Lorem ipsum dolor sit amet, consectetur adipiscing elit, ...
`\end{proof}`
```

### Linked proofs

The following will be printed as "Proof of Theorem 1." by default.

```markdown
`\begin{proof}`@[[(link to Theorem 1)]]
Lorem ipsum dolor sit amet, consectetur adipiscing elit, ...
`\end{proof}`
```

## Settings & styling

Don't like `\begin{proof}`? You can use any string you like instead. Go to the plugin setting tab, and modify the **Beginning of proof** and **Ending of proof** fields. Also take a look at the **Proofs** section in the [profile](context-settings#profile) editing menu.

Beginning/ending of proofs are given the following CSS classes.

- `.math-booster-begin-proof`/`.math-booster-end-proof`
- `.math-booster-begin-proof-{tag}`/`.math-booster-end-proof-{tag}`: `{tag}` is each tag associated with the profile applying to the note.
