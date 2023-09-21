# Math Booster for Obsidian

Turn your Obsidian into ***LaTeX on steroids*** with Math Booster. 

![Screenshot](docs/fig/screenshot.png)

**Math Booster** is an [Obsidian.md](https://obsidian.md/) plugin that enhances your mathematical note-taking experience with several powerful features, including:

- [Equation numbering](https://ryotaushio.github.io/obsidian-math-booster//equation-number)
- [Theorem environments](https://ryotaushio.github.io/obsidian-math-booster//math-callouts)
- [Live suggestions (auto-completion) for theorem/equation links](https://ryotaushio.github.io/obsidian-math-booster//suggest)
- [Rendering equations inside callouts & blockquotes in live preview](https://ryotaushio.github.io/obsidian-math-booster//math-preview)
- [Showing backlinks to theorems/equations](https://ryotaushio.github.io/obsidian-math-booster//backlinks)
- [Proof environments](https://ryotaushio.github.io/obsidian-math-booster//proofs) _(experimental)_

Theorems & equations can be **dynamically/automatically numbered**, while you can statically/manually number them if you want.
The number prefix can be either explicitly specified or automatically inferred from the note title.

Thanks to the integration with [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks), links to theorems/equations are [displayed with their title or number](https://ryotaushio.github.io/obsidian-math-booster//cleveref), similarly to the `cleveref` package in LaTeX. (No need for manually typing aliases!)

You can also customize the appearance of theorem callouts using CSS snippets. See the [styles gallery](#styles-gallery) for examples.

Also check out the [No More Flickering Inline Math](https://github.com/RyotaUshio/obsidian-inline-math) plugin, which lets you work with inline math much more comfortably.

(The theorem in the screenshot is cited from [Tao, Terence, ed. An introduction to measure theory. Vol. 126. American Mathematical Soc., 2011.](https://terrytao.files.wordpress.com/2012/12/gsm-126-tao5-measure-book.pdf))

## Support development

If you find this plugin useful, please support my work by buying me a coffee!

<a href="https://www.buymeacoffee.com/ryotaushio" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## Documentation

https://ryotaushio.github.io/obsidian-math-booster/

## Dependencies

The following community plugins are required to be installed and enabled:

- [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks) ver. 0.4.6+
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) ver. 0.5.56+

Also, you must install the [CMU Serif](https://www.cufonfonts.com/font/cmu-serif) font to fully enjoy some of the preset styles listed below. Additionally, the [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) font is required to render proofs using the Japanese profile correctly.

## Installation

You can install this plugin inside Obsidian (see [here](https://help.obsidian.md/Extending+Obsidian/Community+plugins#Install+a+community+plugin) for instructions).

Also, you can test the latest beta release using the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.

## Contributing

**I need your help!!**

- Feel free to create a new issue if something is not working well. Questions are also welcomed.
- Please send a pull request if you have any ideas to improve Math Booster and our experience!
  - **Even if you don't code, your help is still needed to improve the documentation and README.** For example, the active update of this plugin has already made some of the images in the documentation outdated...
  - Of course, programmers' contributions are highly welcomed. (I'm pretty new to TypeScript/JavaScript/HTML/CSS. Making this plugin was the only purpose for me to start learning them. So your help is needed for real.)

## Roadmaps

- Import from LaTeX: ArXiv papers, research/literature notes written in LaTeX, ...
- Export to LaTeX: Write research notes in Obsidian, and then export them into LaTeX.
- More user-friendly UI for local settings

## Styles gallery

### Plain

![Plain light](docs/fig/plain.png)
![Plain dark](docs/fig/plain-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/plain.css)

### Framed

![Framed](docs/fig/framed.png)
![Framed dark](docs/fig/framed-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/framed.css)

### MathWiki style

This beautiful style is taken from [MathWiki](https://github.com/zhaoshenzhai/MathWiki). A big thank you to [Zhaoshen Zhai](https://github.com/zhaoshenzhai), the owner of MathWiki and the [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks) plugin, for readily consenting to including it in this documentation.


![MathWiki style](docs/fig/mathwiki.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/mathwiki.css)

### Vivid

![Vivid light](docs/fig/vivid-light.png)
![Vivid dark](docs/fig/vivid-dark.png)

[View CSS snippet](https://github.com/RyotaUshio/obsidian-math-booster/blob/master/styles/vivid.css)

