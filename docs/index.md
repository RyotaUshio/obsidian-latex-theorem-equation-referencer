---
layout: home
title: Overview
---

<figure style="padding-bottom:2em;">
<img src="fig/screenshot.png" alt="Screenshot">
<figcaption style="text-align:center; font-size: 67%; padding-top: 0; padding-left: 6em; padding-right: 6em;">Example theorem cited from:<br><a href="https://terrytao.files.wordpress.com/2012/12/gsm-126-tao5-measure-book.pdf">Tao, Terence, ed. An introduction to measure theory. Vol. 126. American Mathematical Soc., 2011.</a>
</figcaption>
</figure>

**[Math Booster](https://github.com/RyotaUshio/obsidian-math-booster)** is an [Obsidian.md](https://obsidian.md/) plugin that enhances your mathematical note-taking experience with several powerful features, including:

- [Theorem environments: "math callouts"](math-callouts)
- [Automatic equation numbering](equation-number)
- [Proof environments](proofs)
- [Math live preview in callouts & blockquotes](math-preview)

Math callouts & equations can be [referenced with their title or number](cleveref) similarly to the `cleveref` package in LaTeX.

You can also customize the appearance of math callous using CSS snippets. See the [styles gallery](style-your-theorems#styles-gallery) for examples.

## Installation

Although this plugin is still under review by the Obsidian team, you can install it using BRAT.

1. Install the [BRAT](obsidian://show-plugin?id=obsidian42-brat) community plugin and enable it.
2. Go to **Options**. In the **Beta Plugin List** section, click on the **Add Beta plugin** button.
3. Copy and paste `https://github.com/RyotaUshio/obsidian-math-booster` in the pop-up prompt and click on **Add Plugin**.
5. (Optional) Turn on **Auto-update plugins at startup** at the top of the page.
4. Go to **Community plugins > Installed plugins**. You will find "Math Booster" in the list. Click on the toggle button to enable it.

## Dependencies

The following community plugins are required to be installed and enabled.

- [MathLinks](obsidian://show-plugin?id=mathlinks) version >= 0.4.3
- [Dataview](obsidian://show-plugin?id=dataview) version >= 0.5.56

Make sure **Enable MathLinks API** is turned on in the MathLinks plugin settings.

![MathLinks settings](fig/mathlinks.png)

Also, you need to install the [CMU Serif](https://www.cufonfonts.com/font/cmu-serif) font to fully enjoy some of the [preset styles](style-your-theorems#styles-gallery).
Additionally, the [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) font is required to correctly render proofs using the Japanese profile.