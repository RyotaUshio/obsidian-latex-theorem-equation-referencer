---
layout: page
title: Tips
---

## Mute block IDs

Referencing theorems or equations inevitably involves [block IDs](https://help.obsidian.md/Linking+notes+and+files/Internal+links#Link+to+a+block+in+a+note).
If you find them disturbing, try the following CSS snippet. This is a little bit modified version of [hey_look_its_shiny's Reddit post](https://www.reddit.com/r/ObsidianMD/comments/xd0sir/hidden_block_id_snippet/).

```css
/* Block IDs on inactive lines */
.cm-blockid {
    opacity: 0.2;
}
/* Block IDs on active lines */
.cm-active .cm-blockid {
    opacity: 0.7;
}
```

The snippet in the original post makes block IDs on inactive lines completely invisible. But I don't recommend it because it may increase the danger of breaking the relationship between blocks (theorems/equations) and the IDs.
Once this happens, it will be not easy to recover the links.

## Use Linter

Obsidian can't recognize `$$ ... $$` as a math block if 
1. there is no line break between two `$$`s, or
2. there is no empty lines before & after the math block.

[Linter](obsidian://show-plugin?id=obsidian-linter)'s rules
"[Move Math Block Indicators to Their Own Line](https://platers.github.io/obsidian-linter/settings/spacing-rules/#move-math-block-indicators-to-their-own-line)" and
"[Empty Line Around Math Blocks
](https://platers.github.io/obsidian-linter/settings/spacing-rules/#empty-line-around-math-blocks)" help you avoid the first & second one, respectively.

## Use CSS Editor

Your experience with Math Booster will be richer with [CSS snippets](https://help.obsidian.md/Extending+Obsidian/CSS+snippets), but it will be bother to switch to an external text editor (like VSCode) everytime you update your snippets.

The [CSS editor](obsidian://show-plugin?id=css-editor) plugin removes this headache by enabling you to edit your snippets **inside Obsidian**.

## Preamble

The [Extended MathJax](obsidian://show-plugin?id=obsidian-latex) plugin enables you to use a preamble in Obsidian.

## Use No More Flickering Inline Math

I created another plugin [No More Flickering Inline Math](https://github.com/RyotaUshio/obsidian-inline-math), which lets you work with inline math much more comfortably. Check it out!
