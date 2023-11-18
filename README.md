# Math Booster for Obsidian

> [!note]
> Math Booster is moving forward to major version 2! Check out our [new documentation site](https://ryotaushio.github.io/obsidian-math-booster).

Turn your Obsidian into ***LaTeX on steroids*** with Math Booster. 

![Screenshot](https://raw.githubusercontent.com/RyotaUshio/obsidian-math-booster/1c7b106fcfbddccdcda8451de1c21a094994b686/docs/fig/screenshot.png)

**Math Booster** is an [Obsidian.md](https://obsidian.md/) plugin that enhances your mathematical note-taking experience.

## Docs

https://ryotaushio.github.io/obsidian-math-booster

## Features

- [Theorem environments](https://ryotaushio.github.io/obsidian-math-booster/theorem-callouts/theorem-callouts.html)
- [Automatic equation numbering](https://ryotaushio.github.io/obsidian-math-booster/equations.html)
- [Rendering equations inside callouts](https://ryotaushio.github.io/obsidian-math-booster/extending-obsidian's-math-rendering-functionalities/rendering-equations-inside-callouts.html)
- [Multi-line equation support inside blockquotes](https://ryotaushio.github.io/obsidian-math-booster/extending-obsidian's-math-rendering-functionalities/multi-line-equation-support-inside-blockquotes.html)
- [Clever referencing](https://ryotaushio.github.io/obsidian-math-booster/clever-referencing.html)
- [Search modal](https://ryotaushio.github.io/obsidian-math-booster/search-&-link-auto-completion/search-modal.html)
- [Proof environment (experimental)](https://ryotaushio.github.io/obsidian-math-booster/proof-environment.html)

Theorems & equations can be **dynamically/automatically numbered**, while you can statically/manually number them if you want.
The number prefix can be either explicitly specified or automatically inferred from the note title.

Thanks to the integration with [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks), links to theorems/equations are [displayed with their title or number](https://ryotaushio.github.io/obsidian-math-booster//cleveref), similarly to the `cleveref` package in LaTeX. (No need for manually typing aliases!)

You can also customize the appearance of theorem callouts using CSS snippets. See the [styles gallery](#styles-gallery) for examples.

Also check out the [No More Flickering Inline Math](https://github.com/RyotaUshio/obsidian-inline-math) plugin, which lets you work with inline math much more comfortably.

## Installation

Since version 2 is still beta, it's not on the community plugin browser yet.

But you can install the latest beta release using [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1.  Install BRAT and enable it.
2.  Go to `Options`. In the `Beta Plugin List` section, click on the `Add Beta plugin` button.
3.  Copy and paste `RyotaUshio/obsidian-math-booster` in the pop-up prompt and click on **Add Plugin**.
4.  _(Optional but highly recommended)_ Turn on `Auto-update plugins at startup` at the top of the page.
5.  Go to `Community plugins > Installed plugins`. You will find “Math Booster” in the list. Click on the toggle button to enable it.

## Dependencies

### Obsidian plugins

Math Booster requires [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks) version 0.5.1 or higher installed to work properly ([Clever referencing](https://ryotaushio.github.io/obsidian-math-booster/clever-referencing.html)).

In version 2, [Dataview](https://github.com/blacksmithgu/obsidian-dataview) is no longer required. But I strongly recommend installing it because it enhances Math Booster's [search](https://ryotaushio.github.io/obsidian-math-booster/search-&-link-auto-completion/search-modal.html) functionality significantly.

### Fonts

You have to install [CMU Serif](https://www.cufonfonts.com/font/cmu-serif) (which this documentation uses) to get some of the preset styles for [[Theorem callouts|theorem callouts]] displayed properly.

Additionally, [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) is required for render the preset styles properly in Japanese.

(The theorem in the screenshot is cited from [Tao, Terence, ed. An introduction to measure theory. Vol. 126. American Mathematical Soc., 2011.](https://terrytao.files.wordpress.com/2012/12/gsm-126-tao5-measure-book.pdf))

## Contributing

- Feel free to create a new issue if something is not working well. Questions are also welcomed.
- Please send a pull request if you have any ideas to improve Math Booster and our experience!
  - **Even if you don't code, your help is still needed to improve the documentation and README.** For example, the active update of this plugin has already made some of the images in the documentation outdated...
  - Of course, programmers' contributions are highly welcomed.

## Roadmaps

- Import from LaTeX: ArXiv papers, research/literature notes written in LaTeX, ...
- Export to LaTeX: Write research notes in Obsidian, and then export them into LaTeX.

## Support development

If you find this plugin useful, please support my work by buying me a coffee!

<a href="https://www.buymeacoffee.com/ryotaushio" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

