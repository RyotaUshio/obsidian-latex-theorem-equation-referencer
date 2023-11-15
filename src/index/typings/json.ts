//! Note: These are "serialization" types for metadata, which contain
// the absolute minimum information needed to save and load data.

import { Link } from "index/expression/literal";
import { Pos } from "obsidian";
import { MinimalTheoremCalloutSettings, TheoremCalloutSettings } from "settings/settings";

/** A span of contiguous lines. */
export interface LineSpan {
    /** The inclusive start line. */
    start: number;
    /** The inclusive end line. */
    end: number;
}

/** Stores just the minimal information needed to create a markdown file; used for saving and loading these files. */
export interface JsonMarkdownPage {
    /** The path this file exists at. */
    $path: string;
    /** The extension; for markdown files, almost always '.md'. */
    $extension: string;
    /** The full extent of the file (start 0, end the number of lines in the file.) */
    $position: LineSpan;
    /** All links in the file. */
    $links: Link[];
    /**
     * All child markdown sections of this markdown file. The initial section before any content is special and is
     * named with the title of the file.
     */
    $sections: JsonMarkdownSection[];
}

export interface JsonMarkdownSection {
    /** The index of this section in the file. */
    $ordinal: number;
    /** The title of the section; the root (implicit) section will have the title of the page. */
    $title: string;
    /** The indentation level of the section (1 - 6). */
    $level: number;
    /** The span of lines indicating the position of the section. */
    $position: LineSpan;
    // /** All tags on the file. */
    // $tags: string[];
    /** All links in the file. */
    /** -> All links in the SECTION? */
    $links: Link[];
    /** All of the markdown blocks in this section. */
    $blocks: JsonMarkdownBlock[];
}

export interface JsonMarkdownBlock {
    /** The index of this block in the file. */
    $ordinal: number;
    /** The position/extent of the block. */
    $position: LineSpan;
    $pos: Pos;
    /** All links in the file. */
    $links: Link[];
    /** If present, the distinct block ID for this block. */
    $blockId?: string;
    /** The type of block - paragraph, list, and so on. */
    $type: string;
}

export interface JsonMathBoosterBlock extends JsonMarkdownBlock {
    $type: "theorem" | "equation";
    $label?: string;
    $display?: string;
}

export interface JsonTheoremCalloutBlock extends JsonMathBoosterBlock {
    $type: "theorem";
    $settings: MinimalTheoremCalloutSettings;
    $main: boolean;
}

export interface JsonEquationBlock extends JsonMathBoosterBlock {
    $type: "equation";
    $manualTag: string | null;
    $mathText: string;
}
