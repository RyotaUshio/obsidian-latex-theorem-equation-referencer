---
title: Local settings
layout: page
---

Roughly speaking, Math Booster has three types of settings:
- Settings specific to each theorem callout (**Type**, **Number**, **Title**, ...)
- Settings applying to a file or a folder as a whole
- Other settings, mainly related to [live suggestions](suggest)

The second type of settings is called **local settings**. 

In the plugin setting tab, you can set up the **Global** settings. In other words, they are local settings for the vault root.
They apply all the files in the vault unless overwritten by another **local** settings for a lower-level folder/file.

You can make use of this cascaded structure for customizing the settings specific to each textbook or paper, for example:

<pre style="font-family: Consolas, Menlo, Monaco;">
Folder structure                    Local settings
───────────────────────────────────────────────────────────────
vault root
├── Textbook written in Japanese    <--- Profile = "Japanese"
│   ├── Chapter 1
│   │   ├── 1-1.md                  <--- Number prefix = "1.1."
│   │   └── 1-2.md                  <--- Number prefix = "1.2."
│   ├── Chapter 2
│   │   ├── 2-1.md                  <--- Number prefix = "2.1."
│   │   └── 2-2.md                  <--- Number prefix = "2.2."
├── Paper written in English.md     <--- Profile = "English"
├── ...
</pre>

## How to set up local settings

There are several ways to set up the local settings.

- Plugin setting tab
- "Open local settings for the current note" command
- "Open local settings for the current note" button in theorem callout settings

## Description

### Profile

See [profiles](profiles) for the details.
