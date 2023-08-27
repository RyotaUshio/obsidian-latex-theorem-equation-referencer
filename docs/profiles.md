---
layout: page
title: Profiles
---

**Profiles** define the displayed name of each theorem environment (`theorem`/`definition`/`lemma`/...) and proofs.
Click on **Manage profiles** button in a local settings pop-up to open the profile manager.
Here you can edit an exising profile, create a new one from scratch or by copying an exising one, or delete one.

For example, the default "English" profile displays `exercise` as "Exercise."
If you want to change it to "Problem" inside a certain folder, define a new profile:

1. Create a new profile by copying the "English" profile.
2. Modify the "exercise" field of the new profile to "Problem."
3. Apply the profile to the folder.

## Tags

Each profile has **tags**. Tags are used to generate CSS classes.

For example, the preset profiles "English" and "Japanese" have "en" and "ja" as their tags, respectively.
In these cases, tags are used to indicate the language used for the note, making it possible to use different styles depending on it. I recommend defining language tags for your custom profiles too.

Here's a list of the CSS classes generated from tags:

- `.math-booster-{tag}`: (New in 0.6.9) Applies to an entire note. This is very powerful... It acts just like Obsidian's built-in `cssclasses` property ([see here](https://help.obsidian.md/Editing+and+formatting/Properties#Predefined+properties)), but you don't need to manually type in the YAML frontmatter. Also remember that profiles have a [cascaded structure](context-settings) determined by the folder hierarchy, just like other local settings.
- `.theorem-callout-{tag}`: Applies to [theorem callouts](math-callouts).
- `.math-booster-begin-proof-{tag}`/`.math-booster-end-proof-{tag}`: Applies to [proofs](proofs).

Now that we have `.math-booster-{tag}`, the last two might be unnecessary, but I will keep them to ensure backward compatibility and also let users use, for example, `.theorem-callout-en` as a handy alias for `.math-booster-en .theorem-callout`.

Here's a demonstration of how `.math-booster-{tag}` works (in the right pane, I'm using the [CSS editor](tips#use-css-editor)).

![Tags](<fig/tag.gif>)
