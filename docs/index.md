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

Since this plugin is before its official submission, you can only install it manually for the time being.

```bash
$ cd <root of your vault>/.obsidian/plugins
$ git clone https://github.com/RyotaUshio/obsidian-math.git
$ cd obsidian-math
$ npm install
$ npm run build
```
After running these commands, you will find "Obsidian Mathematics" in Settings > Community plugins > Installed plugins. 
Click on the toggle button to enable it.

## Dependency

Although many features of this plugin works without any other community plugins, **I strongly recommend you to install [MathLinks](obsidian://show-plugin?id=mathlinks) version >= 0.4.0 together**.

It allows you to enjoy the [clever referencing](cleveref) feature of this plugin, which will greatly boost your experience.
