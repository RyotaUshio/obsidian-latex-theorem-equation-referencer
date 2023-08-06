---
layout: home
title: Overview
---

**Obsidian Math Booster** is an [Obsidian.md](https://obsidian.md/) plugin that enhances your mathematical note taking experience with several powerful features, including:

- [Special callouts for theorems/definitions/exercises/...](math-callouts)
- [Automatic equation numbering](equation-number)
- [Clever reference to Theorems & equations](cleveref)
- [Math live preview in callouts & blockquotes](math-preview)

## Installation

This plugin is before an official submission.
You can choose between the following two methods for installation.

### Install via BRAT (recommended)

1. Install the [BRAT](obsidian://show-plugin?id=obsidian42-brat) community plugin and enable it.
2. Go to **Options**. In the **Beta Plugin List** section, click on the **Add Beta plugin** button.
3. Copy and paste `https://github.com/RyotaUshio/obsidian-math` in the pop-up prompt and click on **Add Plugin**.
5. (Optional) Turn on **Auto-update plugins at startup** at the top of the page.
4. Go to **Community plugins > Installed plugins**. You will find "Obsidian Math Booster" in the list. Click on the toggle button to enable it.

### Manual installation

1. Make a folder `<root of your vault>/.obsidian/plugins/obsidian-math`.
2. Visit the [release page](https://github.com/RyotaUshio/obsidian-math/releases) of the GitHub repository, and download `main.js`, `manifest.json` and `style.css` in the "Assets" section of the latest release. Put these files in the folder you made in the previous step.
3. Go to Obsidian's **Settings > Community plugins > Installed plugins**. You will find "Obsidian Math Booster" in the list (if not, make sure the [restricted mode](https://help.obsidian.md/Extending+Obsidian/Plugin+security#Restricted+mode) is turned off). 
4. Click on the toggle button to enable it.

## Dependencies

The following community plugin is required to be installed and enabled.

- [Dataview](obsidian://show-plugin?id=dataview) version >= 0.5.0
- [MathLinks](obsidian://show-plugin?id=mathlinks) version >= 0.4.0

Make sure **Enable MathLinks API** is turned on in the MathLinks plugin settings.

![MathLinks settings](fig/mathlinks.png)
