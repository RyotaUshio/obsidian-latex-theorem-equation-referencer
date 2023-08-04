# Obsidian Mathematics

> :warning: **This plugin is in the very early stages of development.**

This is a plugin for [Obsidian.md](https://obsidian.md), which enhances your mathematical note taking experience by introducing $\LaTeX$-like features into Obsidian.

Obsidian is great, but when it comes to mathematical notes, it lacks some of important features that $\LaTeX$ has.
And this is where Obsidian Mathematics comes in!

plugin that enhances your mathematical note taking experience by several powerful features, including:

- [Special Callouts for Theorems/Definitions/Exercises/...](https://ryotaushio.github.io/obsidian-math/math-callouts)
- [Automatic Equation Numbering](https://ryotaushio.github.io/obsidian-math/equation-number)
- [Clever Reference to Theorems & Equations](https://ryotaushio.github.io/obsidian-math/cleveref)
- [Math Preview in Callouts & Blockquotes](https://ryotaushio.github.io/obsidian-math/math-preview)

See the [documentation](https://ryotaushio.github.io/obsidian-math) for the details.

## Demos

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

It allows you to enjoy the [clever referencing](https://ryotaushio.github.io/obsidian-math/cleveref) feature of this plugin, which will greatly boost your experience.
