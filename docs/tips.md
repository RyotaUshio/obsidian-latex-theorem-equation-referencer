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

## Preamble

The [Extended MathJax](obsidian://show-plugin?id=obsidian-latex) plugin enables you to use a preamble in Obsidian.

## Use Linter

Obsidian can't recognize `$$ ... $$` as a math block if 
1. there is not line break between two `$$`s, or
2. there is not empty line before & after the math block.

[Linter](obsidian://show-plugin?id=obsidian-linter)'s rule "[Empty Line Around Math Blocks
](https://platers.github.io/obsidian-linter/settings/spacing-rules/#empty-line-around-math-blocks)" helps you avoid the second one.

## Use No More Flickering Inline Math

I created another plugin [No More Flickering Inline Math](https://github.com/RyotaUshio/obsidian-inline-math), which lets you work with inline math much more comfortably. Check it out!
