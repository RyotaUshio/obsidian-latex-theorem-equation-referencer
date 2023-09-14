---
layout: page
title: Live suggestion of theorems & equations
---

Math Booster lets you insert links to theorems or equations with ease.

In the editor, type `\ref` (by default; you can change it as you like in the plugin settings).
Then, live suggestions for all theorem callouts & equation blocks in the entire vault show up.

![Suggestions show up](fig/suggest-ref.png)

Press <kbd>Enter</kbd> to insert a link to the selected item.

![Suggestion inserted](fig/suggest-insert.png)

Or you can jump to the selected item by pressing <kbd>Cmd</kbd> + <kbd>Enter</kbd> on Mac / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> on Windows.

![Jump to suggestion](fig/suggest-jump.png)

Use `\tref` or `\eqref` (by default) instead of `\ref` to suggest only theorems or only equations.

<div style="display: flex;">
  <div style="flex: 49%; padding: 5px;">
    <img src="fig/suggest-theorem.png" alt="Suggest only theorems" style="width:100%">
  </div>
  <div style="flex: 49%; padding: 5px;">
    <img src="fig/suggest-equation.png" alt="Suggest only equations" style="width:100%">
  </div>
</div>

## Available search keys

### Theorem suggestion

| Key              | Example                   |
| ---------------- | ------------------------- |
| Environment type | definition, theorem, ...  |                                                
| Formatted title  | Definition 1.1 (Continuity) |                                                
| Formatted label  | def:continuity              |                                                
| Note path        | folder/note.md            |
| Tags             | #calculus                          | 

![Theorem suggestion example](fig/suggest-theorem-ex.png)

### Equation suggestion

| Key                         | Example        |
| --------------------------- | -------------- |
| Equation number (if exists) | (1)            |
| LaTeX source code | `\lim_{n \to \infty} \int f_n \, d\mu = \int f \, d\mu` |
| Note path                   | folder/note.md |
| Tags                        | #measure-theory      |

![Equation suggestion example](fig/suggest-equation-ex.png)

## Remark

This feature inserts wikilinks (i.e. `[[]]`) even if you are turning off **Use [[Wikilinks]]** in the app settings because markdown links are not suitable for dynamically updating the displayed text.