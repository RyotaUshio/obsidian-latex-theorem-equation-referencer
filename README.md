# Obsidian Mathematics

This is a plugin for [Obsidian.md](https://obsidian.md), which enhances your mathematical note taking experience.

# Features

## Math callouts

In $\LaTeX$, the `amsthm` package allows us to use a variety of theorem-like environments, such as Theorem, Definitions, Remarks, etc.

In Obsidian, however, we don't have any built-in features taylor-made for such a purpose.
One of the most natural alteranatives would be using Obsidian's [Callouts](https://help.obsidian.md/Editing+and+formatting/Callouts).

hogehoge.

The `Insert math callout` command

- automatic numbering
- custom styling with CSS snippets

## CSS

```css
.callout[data-callout="math"] {
    --callout-color: 192, 7, 7;
    border-left:  5px solid rgb(var(--callout-color));
    border-radius: 0px;
    padding: 0px;
}

.callout[data-callout="math"] > .callout-title {
    padding: 6px;
    padding-left: 12px;
}

.callout[data-callout="math"] > .callout-title > .callout-icon {
    display: none;
}

.callout[data-callout="math"] > .callout-title > .callout-title-inner {
    font-weight: 500;
    color: rgb(var(--callout-color));
}


.callout[data-callout="math"] > .callout-content {
    background-color: var(--background); /* --background is defined in the Sanctum theme.css */
    padding: 1px 20px 2px 20px;
}


.callout[data-callout="math"].math-callout-en > .callout-title > .callout-title-inner {
    font-style: italic;
}

.callout[data-callout="math"].math-callout-en > .callout-content {
    font-style: italic;
}
```