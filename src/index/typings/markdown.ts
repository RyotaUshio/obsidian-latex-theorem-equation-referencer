import { Link } from "index/expression/literal";
import { getFileTitle } from "index/utils/normalizers";
import {
    FILE_TYPE,
    File,
    Indexable,
    LINKABLE_TYPE,
    LINKBEARING_TYPE,
    Linkable,
    Linkbearing,
} from "index/typings/indexable";
import {
    LineSpan,
    JsonMarkdownPage,
    JsonMarkdownSection,
    JsonMarkdownBlock,
    JsonTheoremCalloutBlock,
    JsonEquationBlock,
} from "./json";
import { MinimalTheoremCalloutSettings } from "settings/settings";
import { Pos } from "obsidian";

/** A link normalizer which takes in a raw link and produces a normalized link. */
export type LinkNormalizer = (link: Link) => Link;
export const NOOP_NORMALIZER: LinkNormalizer = (x) => x;

/** A markdown file in the vault; the source of most metadata. */
export class MarkdownPage implements File, Linkbearing, Indexable {
    /** All of the types that a markdown file is. */
    static TYPES = [FILE_TYPE, "markdown", "page", LINKABLE_TYPE, LINKBEARING_TYPE];

    // Use static types for all markdown files.
    $types: string[] = MarkdownPage.TYPES;
    $typename: string = "Page";

    // Markdown file IDs are always just the full path.
    get $id() {
        return this.$path;
    }
    // The file of a file is... it's file.
    get $file() {
        return this.$path;
    }

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
    $sections: MarkdownSection[] = [];

    /**
     * Maps a block ID to the corresponding markdown block in this page.
     */
    $blocks: Map<string, MarkdownBlock>;

    /** $refName of the main theorem callout, if any. */
    $refName?: string

    /** Create a markdown file from the given raw values. */
    static from(raw: JsonMarkdownPage, normalizer: LinkNormalizer = NOOP_NORMALIZER): MarkdownPage {
        const sections = raw.$sections.map((sect) => MarkdownSection.from(sect, raw.$path, normalizer));
        const blocks = new Map<string, MarkdownBlock>();
        for (const section of sections) {
            for (const block of section.$blocks) {
                if (block.$blockId) blocks.set(block.$blockId, block);
            }
        }

        return new MarkdownPage({
            $path: raw.$path,
            $extension: raw.$extension,
            $position: raw.$position,
            $links: raw.$links.map(normalizer),
            $sections: sections,
            $blocks: blocks,
        });
    }

    private constructor(init: Partial<MarkdownPage>) {
        Object.assign(this, init);
    }

    /** Return the number of lines in the document. */
    get $lineCount() {
        return this.$position.end;
    }

    /** The name of the file. */
    get $name() {
        return getFileTitle(this.$path);
    }

    /** A link to this file. */
    get $link() {
        return Link.file(this.$path);
    }

    /** Convert this page into it's partial representation for saving. */
    public partial(): JsonMarkdownPage {
        return {
            $path: this.$path,
            $extension: this.$extension,
            $position: this.$position,
            $links: this.$links,
            $sections: this.$sections.map((sect) => sect.partial()),
        };
    }

    public getBlockByLineNumber(line: number) {
        const section = this.$sections.find((section) => section.$position.start <= line && line <= section.$position.end);
        const block = section?.$blocks.find((block) => block.$position.start <= line && line <= block.$position.end);
        return block;
    }

    static isMarkdownPage(object: Indexable | undefined): object is MarkdownPage {
        return object !== undefined && '$typename' in object && (object as any).$typename === 'Page';
    }
}

export class MarkdownSection implements Indexable, Linkable, Linkbearing {
    /** All of the types that a markdown section is. */
    static TYPES = ["markdown", "section", LINKABLE_TYPE, LINKBEARING_TYPE];

    /** Path of the file that this section is in. */
    $types: string[] = MarkdownSection.TYPES;
    $typename: string = "Section";
    $id: string;
    $file: string;

    /** The index of this section in the file. */
    $ordinal: number;
    /** The title of the section; the root (implicit) section will have the title of the page. */
    $title: string;
    /** The indentation level of the section (1 - 6). */
    $level: number;
    /** The span of lines indicating the position of the section. */
    $position: LineSpan;
    /** All tags on the file. */
    $tags: string[];
    /** All links in the file. */
    $links: Link[];
    /** All of the markdown blocks in this section. */
    $blocks: MarkdownBlock[];

    /** Convert raw markdown section data to the appropriate class. */
    static from(raw: JsonMarkdownSection, file: string, normalizer: LinkNormalizer = NOOP_NORMALIZER): MarkdownSection {
        const blocks = raw.$blocks.map((block) => MarkdownBlock.from(block, file, normalizer));
        return new MarkdownSection({
            $file: file,
            $id: MarkdownSection.readableId(file, raw.$title, raw.$ordinal),
            $ordinal: raw.$ordinal,
            $title: raw.$title,
            $level: raw.$level,
            $position: raw.$position,
            $links: raw.$links.map(normalizer),
            $blocks: blocks,
        });
    }

    private constructor(init: Partial<MarkdownSection>) {
        Object.assign(this, init);
    }

    /** Obtain the number of lines in the section. */
    get $lineCount(): number {
        return this.$position.end - this.$position.start;
    }

    /** Alias for title which allows searching over pages and sections by 'name'. */
    get $name(): string {
        return this.$title;
    }

    /** Return a link to this section. */
    get $link(): Link {
        return Link.header(this.$file, this.$title);
    }

    public partial(): JsonMarkdownSection {
        return {
            $ordinal: this.$ordinal,
            $title: this.$title,
            $level: this.$level,
            $position: this.$position,
            $links: this.$links,
            $blocks: this.$blocks.map((block) => block.partial()),
        };
    }

    /** Generate a readable ID for this section using the first 8 characters of the string and the ordinal. */
    static readableId(file: string, title: string, ordinal: number): string {
        const first8 = title.substring(0, Math.min(title.length, 8)).replace(/[^A-Za-z0-9-_]+/gi, "-");

        return `${file}/section${ordinal}/${first8}`;
    }

    static isMarkdownSection(object: Indexable | undefined): object is MarkdownSection {
        return object !== undefined && '$typename' in object && (object as any).$typename === 'Section';
    }
}

/** Base class for all markdown blocks. */
export class MarkdownBlock implements Indexable, Linkbearing {
    static TYPES = ["markdown", "block", LINKBEARING_TYPE];

    $types: string[] = MarkdownBlock.TYPES;
    $typename: string = "Block";
    $id: string;
    $file: string;

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

    static from(object: JsonMarkdownBlock, file: string, normalizer: LinkNormalizer = NOOP_NORMALIZER): MarkdownBlock {
        if (object.$type === "theorem") {
            return TheoremCalloutBlock.from(object as JsonTheoremCalloutBlock, file, normalizer);
        } else if (object.$type === "equation") {
            return EquationBlock.from(object as JsonEquationBlock, file, normalizer);
        }

        return new MarkdownBlock({
            $file: file,
            $id: MarkdownBlock.readableId(file, object.$ordinal),
            $ordinal: object.$ordinal,
            $position: object.$position,
            $pos: object.$pos,
            $links: object.$links.map(normalizer),
            $blockId: object.$blockId,
            $type: object.$type,
        });
    }

    protected constructor(init: Partial<MarkdownBlock>) {
        Object.assign(this, init);
    }

    /** If this block has a block ID, the link to this block. */
    get $link(): Link | undefined {
        if (this.$blockId) return Link.block(this.$file, this.$blockId);
        else return undefined;
    }
    public partial(): JsonMarkdownBlock {
        return {
            $ordinal: this.$ordinal,
            $position: this.$position,
            $pos: this.$pos,
            $links: this.$links,
            $blockId: this.$blockId,
            $type: this.$type,
        };
    }

    /** Generate a readable ID for this block using the ordinal of the block. */
    static readableId(file: string, ordinal: number): string {
        return `${file}/block${ordinal}`;
    }

    static isMarkdownBlock(object: Indexable | undefined): object is MarkdownSection {
        return object !== undefined && object.$types.includes('block');
    }
}



export abstract class MathBoosterBlock extends MarkdownBlock {
    // only set after backlinks are ready
    abstract $printName: string | null; // declaring as abstract to treat like an interface
    $refName: string | null;

    /** Additional metadata specified via comments */
    $label?: string;
    $display?: string;

    static isMathBoosterBlock(object: Indexable | undefined): object is MathBoosterBlock {
        return object !== undefined && object.$types.includes('block-math-booster');
    }
}

export class TheoremCalloutBlock extends MathBoosterBlock implements Linkbearing {
    static TYPES = ["markdown", "block", "block-math-booster", "block-theorem", LINKBEARING_TYPE];

    $types: string[] = TheoremCalloutBlock.TYPES;
    $typename: string = "Theorem Callout Block";
    $type: string = "theorem";

    /** True if written in the version-1 format of '> [!math|{"type":"theorem",...}]"' */
    $v1: boolean;

    /** The settings for this theorem callout. */
    $settings: MinimalTheoremCalloutSettings;

    $titleSuffix: string;

    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "Theorem 1.1" */
    $theoremMainTitle: string;

    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "theorem" */
    get $theoremType(): string {
        return this.$settings.type;
    }

    get $numberSpec(): string {
        return this.$settings.number;
    }

    /** e.g. Theorem 1.1 (Cauchy-Schwarz) -> "Cauchy-Schwarz" */
    get $theoremSubtitle(): string | undefined {
        return this.$settings.title;
    }

    /** e.g. "Theorem 1.1 (Cauchy-Schwarz)" */
    get $printName(): string {
        return this.$theoremSubtitle ? `${this.$theoremMainTitle} (${this.$theoremSubtitle})` : this.$theoremMainTitle;
    }

    /** Additional metadata specified via comments */
    $main: boolean;

    static from(
        object: JsonTheoremCalloutBlock,
        file: string,
        normalizer: LinkNormalizer = NOOP_NORMALIZER
    ): TheoremCalloutBlock {
        /**
         * `printName` and `refName` can be computed only after the backlinks get ready
         * because only linked equations are numbered. We have to wait until then.
         */
        return new TheoremCalloutBlock({
            $file: file,
            $id: MarkdownBlock.readableId(file, object.$ordinal),
            $ordinal: object.$ordinal,
            $position: object.$position,
            $pos: object.$pos,
            $links: object.$links.map(normalizer),
            $blockId: object.$blockId,
            $type: object.$type,
            $settings: object.$settings,
            $label: object.$label,
            $display: object.$display,
            $main: object.$main,
            $v1: object.$v1,
        });
    }

    public partial(): JsonMarkdownBlock {
        return Object.assign(super.partial(), {
            $settings: this.$settings,
            $label: this.$label,
            $display: this.$display,
            $main: this.$main,
            $v1: this.$v1,
        });
    }

    public constructor(init: Partial<TheoremCalloutBlock>) {
        super(init);
    }

    static isTheoremCalloutBlock(object: Indexable | undefined): object is TheoremCalloutBlock {
        return object !== undefined && object.$types.includes('block-theorem');
    }
}

export class EquationBlock extends MathBoosterBlock {
    static TYPES = ["markdown", "block", "block-math-booster", "block-equation"];

    $types: string[] = EquationBlock.TYPES;
    $typename: string = "Equation Block";
    $type: string = "equation";

    $printName: string | null = null;
    /** The math text of this equation. */
    $mathText: string;
    $manualTag: string | null;

    static from(
        object: JsonEquationBlock,
        file: string,
        normalizer: LinkNormalizer = NOOP_NORMALIZER
    ): EquationBlock {
        /**
         * `printName` and `refName` can be computed only after the backlinks get ready
         * because only linked equations are numbered. We have to wait until then.
         */
        return new EquationBlock({
            $file: file,
            $id: MarkdownBlock.readableId(file, object.$ordinal),
            $ordinal: object.$ordinal,
            $position: object.$position,
            $pos: object.$pos,
            $links: object.$links.map(normalizer),
            $blockId: object.$blockId,
            $type: object.$type,
            $mathText: object.$mathText,
            $manualTag: object.$manualTag,
            $label: object.$label,
            $display: object.$display,
        });
    }

    public partial(): JsonMarkdownBlock {
        return Object.assign(super.partial(), {
            $mathText: this.$mathText,
            $manualTag: this.$manualTag,
            $label: this.$label,
            $display: this.$display,
        });
    }

    public constructor(init: Partial<EquationBlock>) {
        super(init);
    }

    static isEquationBlock(object: Indexable | undefined): object is EquationBlock {
        return object !== undefined && object.$types.includes('block-equation');
    }
}
