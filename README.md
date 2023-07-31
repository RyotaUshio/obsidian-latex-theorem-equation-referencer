> :warning: **This plugin is in the very early stages of development!**

# Obsidian Mathematics

This is a plugin for [Obsidian.md](https://obsidian.md), which enhances your mathematical note taking experience.

Obsidian is great, but when it comes to mathematical notes, it lacks some of important features that $\LaTeX$ has.

- theorem environments
- automatic, dynamic numbering of theorems & equations
- clever references

And this is where Obsidian Mathematics comes in!

## Installation

Since this plugin is before official submission, you can only manually install it.

## Dependencies 

Although many features of this plugin don't depend on other community plugins, I strongly recommend you to install [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks)  together.





## Features

- Math callouts
- Automatic equation numbering

### Math callouts

In $\LaTeX$, the `amsthm` package allows us to use a variety of theorem-like environments, such as Theorem, Definitions, Remarks, etc.

In Obsidian, however, we don't have any built-in features taylor-made for such a purpose.
One of the most natural alteranatives would be using Obsidian's [Callouts](https://help.obsidian.md/Editing+and+formatting/Callouts).

This plugin offers callouts for such theorem-like environments. And they are on STEROID.

### Automatic equation numbering 

Automatically numbering equations in a referencable manner has been one of the long-standing unsolved problems of Obsidian
(see [this topic](https://forum.obsidian.md/t/automatic-equation-numbering-latex-math/1325/30) on the forum).

But it isn't anymore! :tada:

Obsidian Mathematics automatically & dynamically indexes displayed (i.e. full-width) equations `$$ ... $$` with [block IDs](https://help.obsidian.md/Linking+notes+and+files/Internal+links#Link+to+a+block+in+a+note) (e.g. `^my-id`) and renders their equation number both in Live Preview & Reading Mode. 

In other words, there's nothing that you have to do. When you insert a link to an equation, Obsidian generates a block ID for it. 
And then, this plugin automatically adjusts the equation numbers to it.

### MathLinks Integration

Obsidian Mathematics can dynamically generate theorem titles and display them well, even if they contain inline math. 
By integrating with [MathLinks](https://github.com/zhaoshenzhai/obsidian-mathlinks.git), the auto-generated titles can also be 
displayed in internal links.


MathLinks is another powerful community plugin that enables Obsidian to render internal links containing inline math. 

I personally recommend you to use [Quick Switcher++](https://github.com/darlal/obsidian-switcher-plus.git)'s symbol command (`@`) to insert internal links to math callouts.


## Commands

### Insert Display Math

### Insert Inline Math

### Insert Math Callout

### Open Local Settings for the Current Note


## Settings



## Docs


<dl>
  <dt>Type</dt>
  <dd>Either of the following: <br><em>lemma, 
    proposition, 
    theorem,
    corollary,
    definition,
    claim, 
    assumption,
    example,
    exercise,
    conjecture,
    hypothesis
    </em>
</dd>
  <dt>Number</dt>
  <dd>How this env will be numbered. Allowed values are: 
  <ul>
  <li> 
  <em>auto</em>: automatically numbered within the currennt note, across different types of environments. 
  <br>
  ex) Definition 1, Lemma 2, Lemma 3, Theorem 4, ...
  </li>
  <li> <em>(blank)</em>: unnumbered. </li>
  </ul>
  </dd>
</dl>

## CSS

You can customize the appearance of math-callouts to be specific to languages or environments (theorem/definition/...)

### CSS classes defined by this plugin

- `.math-callout-{type}`: Indicates the environment type. For example, a math callout whose type is "theorem" will be given the `.math-callout-theorem` class.
- `.math-callout-{language code}`: Indicates the language used for the math callout. Currently only _en_ and _ja_ are available.

### Obsidian built-in CSS classes
- `.callout-title-inner`
- `.callout-content`