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

- [Special "math callouts" for theorems/definitions/exercises/...](math-callouts)
- [Automatic equation numbering](equation-number)
- [Math live preview in callouts & blockquotes](math-preview)

Math callouts & equations can be [referenced with their title or number](cleveref) similarly to the `cleveref` package in LaTeX.

You can also customize the appearance of math callous using CSS snippets. See the [styles gallery](style-your-theorems#styles-gallery) for examples.

## Installation

Since this plugin is under review by the Obsidian team, you can't install it within the Obsidian app for now.
You can choose between the following two methods for installation.

### Install via BRAT (recommended)

1. Install the [BRAT](obsidian://show-plugin?id=obsidian42-brat) community plugin and enable it.
2. Go to **Options**. In the **Beta Plugin List** section, click on the **Add Beta plugin** button.
3. Copy and paste `https://github.com/RyotaUshio/obsidian-math-booster` in the pop-up prompt and click on **Add Plugin**.
5. (Optional) Turn on **Auto-update plugins at startup** at the top of the page.
4. Go to **Community plugins > Installed plugins**. You will find "Math Booster" in the list. Click on the toggle button to enable it.

### Manual installation

1. Make a folder `<root of your vault>/.obsidian/plugins/obsidian-math-booster`.
2. Visit the [release page](https://github.com/RyotaUshio/obsidian-math-booster/releases) of the GitHub repository, and download `main.js`, `manifest.json` and `style.css` in the "Assets" section of the latest release. Put these files in the folder you made in the previous step.
3. Go to Obsidian's **Settings > Community plugins > Installed plugins**. You will find "Math Booster" in the list (if not, make sure the [restricted mode](https://help.obsidian.md/Extending+Obsidian/Plugin+security#Restricted+mode) is turned off). 
4. Click on the toggle button to enable it.

## Dependencies

The following community plugins are required to be installed and enabled.

- [Dataview](obsidian://show-plugin?id=dataview) version >= 0.5.56
- [MathLinks](obsidian://show-plugin?id=mathlinks) version >= 0.4.1

Make sure **Enable MathLinks API** is turned on in the MathLinks plugin settings.

![MathLinks settings](fig/mathlinks.png)
