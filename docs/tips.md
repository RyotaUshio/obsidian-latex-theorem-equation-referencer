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
