---
layout: page
title: Style your theorems
---

You can customize the appearance of math callouts using [CSS snippets](https://help.obsidian.md/Extending+Obsidian/CSS+snippets).

Math Booster defines several [custom CSS classes](#math-boosters-custom-classes), allowing you to change the styles depending on specific languages or environments (theorem/definition/...).

## CSS classes

### Obsidian built-in classes

- `.callout`
  - `.callout > .callout-title`
    - `.callout > .callout-title > .callout-icon`
    - `.callout > .callout-title > .callout-title-inner`
  - `.callout > .callout-content`

### Math Booster's custom classes

- `.math-callout`: Assigned to all math callouts. You can use it as an alternative to `.callout[data-callout="math"]`.
- `.math-callout-{type}`: Indicates the environment type. For example, a math callout whose type is "theorem" will be given the `.math-callout-theorem` class.
- `.math-callout-{language code}`: Indicates the language used for the math callout. Currently only `en` and `ja` are available.
- `.math-callout-subtitle`: Corresponds to the **title** field in the math callout settings. Lives inside `.callout-title-inner`. Ex) Theorem 1.1 (here is `.math-callout-subtitle`)

## Styles gallery

Note that **Title suffix** is set to "." in the examples below.

Example theorem cited from: [Tao, Terence, ed. An introduction to measure theory. Vol. 126. American Mathematical Soc., 2011.](https://terrytao.files.wordpress.com/2012/12/gsm-126-tao5-measure-book.pdf)

### Plain

![Plain light](fig/plain.png)
![Plain dark](fig/plain-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/docs/styles/plain.css)

### Framed

![Framed](fig/framed.png)
![Framed dark](fig/framed-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/docs/styles/framed.css)

### MathWiki style

This beautiful style is taken from [MathWiki](https://github.com/zhaoshenzhai/MathWiki). A big thank you to [Zhaoshen Zhai](https://github.com/zhaoshenzhai), the owner of MathWiki and the [MathLinks](obsidian://show-plugin?id=mathlinks) plugin, for readily consenting to including it in this documentation.


![MathWiki style](fig/mathwiki.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/docs/styles/mathwiki.css)

### Vivid

![Vivid light](fig/vivid-light.png)
![Vivid dark](fig/vivid-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/docs/styles/vivid.css)
