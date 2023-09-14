---
layout: home
title: Overview
---

Turn your Obsidian into ***LaTeX on steroids*** with Math Booster. 

<figure style="padding-bottom:2em;">
<img src="fig/screenshot.png" alt="Screenshot">
<figcaption style="text-align:center; font-size: 67%; padding-top: 0; padding-left: 6em; padding-right: 6em;">Example theorem cited from:<br><a href="https://terrytao.files.wordpress.com/2012/12/gsm-126-tao5-measure-book.pdf">Tao, Terence, ed. An introduction to measure theory. Vol. 126. American Mathematical Soc., 2011.</a>
</figcaption>
</figure>

**[Math Booster](https://github.com/RyotaUshio/obsidian-math-booster)** is an [Obsidian.md](https://obsidian.md/) plugin that enhances your mathematical note-taking experience with several powerful features, including:

- [Equation numbering](equation-number)
- [Theorem environments](math-callouts)
- [Live suggestions (auto-completion) for theorem/equation links](suggest)
- [Rendering equations inside callouts & blockquote in live preview](math-preview)
- [Showing backlinks to theorems/equations](backlinks)
- [Proof environments](proofs) _(experimental)_

Theorems & equations can be **dynamically/automatically numbered**, while you can statically/manually number them if you want.
The number prefix can be either explicitly specified or automatically inferred from the note title.

Thanks to the integration with [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks), links to theorems/equations are [displayed  with their title or number](cleveref) similarly to the `cleveref` package in LaTeX. (No need for manual typing of aliases!)

You can also customize the appearance of theorem callouts using CSS snippets. See the [styles gallery](style-your-theorems#styles-gallery) for examples.

## Support development

If you find this plugin useful, please support my work by buying me a coffee!

<a href="https://www.buymeacoffee.com/ryotaushio" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## Installation

You can install this plugin inside Obsidian (see [here](https://help.obsidian.md/Extending+Obsidian/Community+plugins#Install+a+community+plugin) for instructions).

## Dependencies

The following community plugins are required to be installed and enabled.

- [MathLinks](obsidian://show-plugin?id=mathlinks) version >= 0.4.6
- [Dataview](obsidian://show-plugin?id=dataview) version >= 0.5.56

Make sure **Enable MathLinks API** is turned on in the MathLinks plugin settings.

![MathLinks settings](fig/mathlinks.png)

Also, you need to install the [CMU Serif](https://www.cufonfonts.com/font/cmu-serif) font to fully enjoy some of the [preset styles](style-your-theorems#styles-gallery).
Additionally, the [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) font is required to correctly render proofs using the Japanese profile.
