---
layout: home
title: Obsidian Mathematics
---

This is an [Obsidian.md](https://obsidian.md/) plugin that enhances your mathematical note taking experience by several powerful features, including:

- [Special Callouts for Theorems/Definitions/Exercises/...](math-callouts)
- [Automatic Equation Numbering](equation-number)
- [Clever Reference to Theorems & Equations](cleveref)
- [Math Preview in Callouts & Blockquotes](math-preview)

## Installation

This plugin is before an official submission. 
You can choose between the following two methods for installation. 

### Install via BRAT (recommended)

1. Install the [BRAT](obsidian://show-plugin?id=obsidian42-brat) community plugin and enable it.
2. Go to **Options**. In the **Beta Plugin List** section, click on the **Add Beta plugin** button. 
3. Paste `https://github.com/RyotaUshio/obsidian-math` in the pop-up prompt and click on **Add Plugin**.
5. (Optional) Turn on **Auto-update plugins at startup** on the top of the page.
4. Go to **Community plugins > Installed plugins**. You will find "Obsidian Mathematics" in the list. Click on the toggle button to enable it.

### Manual installation

1. Make a folder `<root of your vault>/.obsidian/plugins/obsidian-math`.
2. Visit the [release page](https://github.com/RyotaUshio/obsidian-math/releases) of the GitHub repository, and download `main.js`, `manifest.json` and `style.css` in the "Assets" section of the latest release. Put these files in the folder that you've just made in the previous step.
3. Go to Obsidian's **Settings > Community plugins > Installed plugins**. You will find "Obsidian Mathematics" in the list (if not, make sure the [restricted mode](https://help.obsidian.md/Extending+Obsidian/Plugin+security#Restricted+mode) is turned off). 
4. Click on the toggle button to enable it.

## Dependency

Although many features of this plugin works without any other community plugins, **I strongly recommend you to install [MathLinks](obsidian://show-plugin?id=mathlinks) version >= 0.4.0 together**.

It allows you to enjoy the [clever referencing](cleveref) feature of this plugin, which will greatly boost your experience.
