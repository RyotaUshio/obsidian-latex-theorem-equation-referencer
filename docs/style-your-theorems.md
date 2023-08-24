---
layout: page
title: Style your theorems
---

You can customize the appearance of theorem callouts either by **your own custom [CSS snippets](https://help.obsidian.md/Extending+Obsidian/CSS+snippets)** or by **[preset sample styles](#styles-gallery)**.

In the plugin settings, set **Theorem callouts > Style** to be **custom** if you want to use your custom CSS snippets. 
Math Booster defines several [custom CSS classes](#math-boosters-custom-classes), allowing you to change the styles depending on specific languages or environments (theorem/definition/...).

Otherwise, the selected preset style will be applied. You need to reopen the note to see the style change.
When **Don't override the app's font setting when using sample styles** is turned on, the preset style will not change the default font family defined in the app's **Settings > Appearance > Font > Text font**.

![Style setting](fig/style_setting.png)


## CSS classes

### Obsidian built-in classes

- `.callout`
  - `.callout > .callout-title`
    - `.callout > .callout-title > .callout-icon`
    - `.callout > .callout-title > .callout-title-inner`
  - `.callout > .callout-content`

### Math Booster's custom classes

- `.theorem-callout`: Assigned to all theorem callouts. You can use it as an alternative to `.callout[data-callout="math"]`.
- `.theorem-callout-{type}`: Indicates the environment type. For example, a theorem callout whose type is "theorem" will be given the `.theorem-callout-theorem` class.
- `.theorem-callout-{tag}`: A [profile](context-settings#profile) has tags, each of which is converted to this `.theorem-callout-{tag}` class. As for the default profiles "English" and "Japanese", the tags are "en" and "ja", respectively. They are used to generate CSS classes `.theorem-callout-en` and `.theorem-callout-ja` indicating the language used for the theorem callout, making it possible to use different styles depending on it. I recommend defining language tags for your custom profiles.
- `.theorem-callout-subtitle`: Corresponds to the **title** field in the theorem callout settings. Lives inside `.callout-title-inner`. Ex) Theorem 1.1 (here is `.theorem-callout-subtitle`)

## Styles gallery

Here are the list of preset sample styles. You can also view the CSS snippet generating each style.

Example theorem cited from: [Tao, Terence, ed. An introduction to measure theory. Vol. 126. American Mathematical Soc., 2011.](https://terrytao.files.wordpress.com/2012/12/gsm-126-tao5-measure-book.pdf)

### Plain

![Plain light](fig/plain.png)
![Plain dark](fig/plain-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/plain.css)

### Framed

![Framed](fig/framed.png)
![Framed dark](fig/framed-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/framed.css)

### MathWiki style

This beautiful style is taken from [MathWiki](https://github.com/zhaoshenzhai/MathWiki). A big thank you to [Zhaoshen Zhai](https://github.com/zhaoshenzhai), the owner of MathWiki and the [MathLinks](obsidian://show-plugin?id=mathlinks) plugin, for readily consenting to including it in this documentation.


![MathWiki style](fig/mathwiki.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/mathwiki.css)

### Vivid

![Vivid light](fig/vivid-light.png)
![Vivid dark](fig/vivid-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/vivid.css)
