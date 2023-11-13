import { Link } from "index/expression/link";
import { getFileTitle } from "index/utils/normalizers";
import { CachedMetadata, SectionCache } from "obsidian";
import BTree from "sorted-btree";
import {
    JsonMarkdownBlock,
    JsonMarkdownPage,
    JsonMarkdownSection,
    JsonTheoremCalloutBlock,
    JsonEquationBlock,
} from "index/typings/json";
import { TheoremCalloutPrivateFields, TheoremCalloutSettings } from "settings/settings";

function trimMathText(text: string) {
    return text.match(/\$\$([\s\S]*)\$\$/)?.[1].trim() ?? text;
}

const THEOREM_CALLOUT_PATTERN = /\> *\[\! *math *\|(.*?)\](.*)/;

function matchTheoremCallout(line: string): RegExpExecArray | null {
    if (line) {
        return THEOREM_CALLOUT_PATTERN.exec(line)
    }
    return null;
}

function readTheoremCalloutSettingsAndTitle(line: string): { settings: TheoremCalloutSettings & TheoremCalloutPrivateFields, title: string } | undefined {
    const matchResult = matchTheoremCallout(line);
    if (matchResult) {
        const settings = JSON.parse(matchResult[1]) as TheoremCalloutSettings;
        const title = matchResult[2].trim();
        return { settings, title };
    }
}

function readTheoremCalloutSettings(line: string): TheoremCalloutSettings & TheoremCalloutPrivateFields | undefined {
    const result = readTheoremCalloutSettingsAndTitle(line);
    if (result) {
        return result.settings;
    }
}


/**
 * Given the raw source and Obsidian metadata for a given markdown file,
 * return full markdown file metadata.
 */
export function markdownImport(
    path: string,
    markdown: string,
    metadata: CachedMetadata
): JsonMarkdownPage {
    // Total length of the file.
    const lines = markdown.split("\n");
    const empty = !lines.some((line) => line.trim() !== "");

    //////////////
    // Sections //
    //////////////

    const metaheadings = metadata.headings ?? [];
    metaheadings.sort((a, b) => a.position.start.line - b.position.start.line);

    const sections = new BTree<number, JsonMarkdownSection>(undefined, (a, b) => a - b);
    for (let index = 0; index < metaheadings.length; index++) {
        const section = metaheadings[index];
        const start = section.position.start.line;
        const end =
            index == metaheadings.length - 1 ? lines.length - 1 : metaheadings[index + 1].position.start.line - 1;

        sections.set(start, {
            $ordinal: index + 1,
            $title: section.heading,
            $level: section.level,
            $position: { start, end },
            $blocks: [],
            $links: [],
        });
    }

    // Add an implicit section for the "heading" section of the page if there is not an immediate header but there is
    // some content in the file. If there are other sections, then go up to that, otherwise, go for the entire file.
    const firstSection: [number, JsonMarkdownSection] | undefined = sections.getPairOrNextHigher(0);
    if ((!firstSection && !empty) || (firstSection && !emptylines(lines, 0, firstSection[1].$position.start))) {
        const end = firstSection ? firstSection[1].$position.start - 1 : lines.length;
        sections.set(0, {
            $ordinal: 0,
            $title: getFileTitle(path),
            $level: 1,
            $position: { start: 0, end },
            $blocks: [],
            $links: [],
        });
    }

    ////////////
    // Blocks //
    ////////////

    // All blocks; we will assign tags and other metadata to blocks as we encounter them. At the end, only blocks that
    // have actual metadata will be stored to save on memory pressure.
    const blocks = new BTree<number, JsonMarkdownBlock>(undefined, (a, b) => a - b);
    let blockOrdinal = 1;
    for (const block of metadata.sections || []) {
        // Skip headings blocks, we handle them specially as sections.
        if (block.type === "heading") continue;

        const start = block.position.start.line;
        const end = block.position.end.line;

        let theoremCalloutSettings: TheoremCalloutSettings | null = null;
        if (block.type === "callout") {
            theoremCalloutSettings = readTheoremCalloutSettings(lines[start]) ?? null;
        }

        if (block.type === "math") {
            const mathText = trimMathText(getBlockText(markdown, block));
            const tagMatch = mathText.match(/\\tag\{(.*)\}/);
            blocks.set(start, {
                $ordinal: blockOrdinal++,
                $position: { start, end },
                $links: [],
                $blockId: block.id,
                $manualTag: tagMatch?.[1],
                $mathText: mathText,
                $type: "equation",
            } as JsonEquationBlock);
        } else if (theoremCalloutSettings) {
            blocks.set(start, {
                $ordinal: blockOrdinal++,
                $position: { start, end },
                $links: [],
                $blockId: block.id,
                $settings: theoremCalloutSettings,
                $type: "theorem",
            } as JsonTheoremCalloutBlock);
        } else {
            blocks.set(start, {
                $ordinal: blockOrdinal++,
                $position: { start, end },
                $links: [],
                $blockId: block.id,
                $type: block.type,
            });
        }
    }

    // Add blocks to sections.
    for (const block of blocks.values() as Iterable<JsonMarkdownBlock>) {
        const section = sections.getPairOrNextLower(block.$position.start);

        if (section && section[1].$position.end >= block.$position.end) {
            section[1].$blocks.push(block);
        }
    }

    ///////////
    // Links //
    ///////////

    const links: Link[] = [];
    for (let linkdef of metadata.links ?? []) {
        const link = Link.infer(linkdef.link);
        const line = linkdef.position.start.line;
        addLink(links, link);

        const section = sections.getPairOrNextLower(line);
        if (section && section[1].$position.end >= line) addLink(section[1].$links, link);

        const block = blocks.getPairOrNextLower(line);
        if (block && block[1].$position.end >= line) addLink(block[1].$links, link);

        const listItem = blocks.getPairOrNextHigher(line);
        if (listItem && listItem[1].$position.end >= line) addLink(listItem[1].$links, link);
    }

    ///////////////////////
    // Frontmatter Links //
    ///////////////////////

    // Frontmatter links are only assigned to the page.
    for (const linkdef of metadata.frontmatterLinks ?? []) {
        const link = Link.infer(linkdef.link, false, linkdef.displayText);
        addLink(links, link);
    }

    return {
        $path: path,
        $links: links,
        $sections: sections.valuesArray(),
        $extension: "md",
        $position: { start: 0, end: lines.length },
    };
}

/** Check if the given line range is all empty. Start is inclusive, end exclusive. */
function emptylines(lines: string[], start: number, end: number): boolean {
    for (let index = start; index < end; index++) {
        if (lines[index].trim() !== "") return false;
    }

    return false;
}

/**
 * Mutably add the given link to the list only if it is not already present.
 * This is O(n) but should be fine for most files; we could eliminate the O(n) by instead
 * using intermediate sets but not worth the complexity.
 */
function addLink(target: Link[], incoming: Link) {
    if (target.find((v) => v.equals(incoming))) return;
    target.push(incoming);
}

function getBlockText(data: string, block: SectionCache) {
    return data.slice(block.position.start.offset, block.position.end.offset);
}