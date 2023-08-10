---
title: Context settings
layout: page
---

Roughly speaking, Math Booster has two types of settings:
- Settings specific to each math callout (**Type**, **Number**, **Title**, ...)
- Settings applying to a file or a folder as a whole

The latter type is called **context settings**. 

In the plugin setting tab, there is the **Global** section at the top.
It is the context settings for the vault root folder, which means it applies all the files in the vault unless overwritten by another **local** folder/file context.

You can make use of this cascaded structure for customizing the settings specific to each textbook or paper, for example:

<pre style="font-family: Consolas, Menlo, Monaco;">
Folder structure                    Context settings
───────────────────────────────────────────────────────────────
vault root
├── Textbook written in Japanese    <--- Language = "ja"
│   ├── Chapter 1
│   │   ├── 1-1.md                  <--- Number prefix = "1.1."
│   │   ├── 1-2.md                  <--- Number prefix = "1.2."
│   ├── Chapter 2
│   │   ├── 2-1.md                  <--- Number prefix = "2.1."
│   │   ├── 2-2.md                  <--- Number prefix = "2.2."
├── Paper written in English.md     <--- Language = "en"
├── ...
</pre>

## How to set up context settings

There are several ways to set up the context settings.

- Plugin setting tab
- "Open Local Settings for the Current Note" command
- "Override context settings" button in math callout settings
