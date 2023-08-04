---
layout: page
title: Math Callouts
---

You can insert **math callouts** specifically designed for mathematical theorems, lemmas, propositions, definitions, and so on, just like the `amsthm` package in LaTeX.

They can be numbered **automatically/dynamically** or **manually/statically**, depending on your preference.
You also have a fine-grained control on their appearance via CSS snippets.

[demo]

See [below](#examples) for more examples.

## How to use

Open the command palette by <kbd>Ctrl</kbd> + <kbd>P</kbd> and run the command `Insert Math Callout`.
A pop-up will appear, where you can configure the information of the theorem.
It has two parts: _item-specific settings_ and _override context settings_.

#### Item-specific Settings

- **Type**: Select from
  - lemma
  - proposition
  - theorem
  - definition
  - corollary
  - ...
- **Number**: Specify how it is numbered
  - "auto" (default): Automatically numbered
  - (blank): Unnumbered
  - otherwise: Manually numbered. The input will be used as is.
- **Title** (optional): If given, the result will be, e.g., "Theorem x.x (`[Title]`)." It can contain inline equations (`$...$`).
- **LaTeX Label** (optional): Used when later converting [pandoc-crossref](https://github.com/lierdakil/pandoc-crossref)-friendly formats

#### Override Context Settings

see ...

### Modify settings afterward

Click the title of an existing math callout to modify its settings. 

[image]

Alternatively, you can directly edit the JSON metadata.

[image]

## Examples

## Style Your Theorems

You can customize the appearance of math callouts to be specific to languages or environments (theorem/definition/...). This can be done using CSS snippets (and Style Settings Plugin in the near future).

### CSS classes defined by this plugin

- `.math-callout-{type}`: Indicates the environment type. For example, a math callout whose type is "theorem" will be given the `.math-callout-theorem` class.
- `.math-callout-{language code}`: Indicates the language used for the math callout. Currently only `en` and `ja` are available.

### Obsidian built-in CSS classes

- `.callout[data-callout="math"]`
  - `.callout[data-callout="math"] > .callout-title`
    - `.callout[data-callout="math"] > .callout-title > .callout-icon`
    - `.callout[data-callout="math"] > .callout-title > .callout-title-inner`
  - `.callout[data-callout="math"] > .callout-content`

### Style examples

[image]
