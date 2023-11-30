import { EditorState, ChangeSet, RangeValue, RangeSet, SelectionRange } from '@codemirror/state';
import { SyntaxNodeRef } from '@lezer/common';
import { MathInfoSet } from 'render-math-in-callouts';
import { EditorPosition, Loc, MarkdownView, editorLivePreviewField } from "obsidian";

export function locToEditorPosition(loc: Loc): EditorPosition {
    return { ch: loc.col, line: loc.line };
}

export function isLivePreview(state: EditorState) {
    return state.field(editorLivePreviewField);
}

export function isSourceMode(state: EditorState) {
    return !isLivePreview(state);
}

export function isReadingView(markdownView: MarkdownView) {
    return markdownView.getMode() === "preview";
}

export function isEditingView(markdownView: MarkdownView) {
    return markdownView.getMode() === "source";
}

/** CodeMirror/Lezer utilities */

export function nodeText(node: SyntaxNodeRef, state: EditorState): string {
    return state.sliceDoc(node.from, node.to);
}

export function printNode(node: SyntaxNodeRef, state: EditorState) {
    // Debugging utility
    console.log(
        `${node.from}-${node.to}: "${nodeText(node, state)}" (${node.name})`
    );
}

export function printMathInfoSet(set: MathInfoSet, state: EditorState) {
    // Debugging utility
    console.log("MathInfoSet:");
    set.between(0, state.doc.length, (from, to, value) => {
        console.log(`  ${from}-${to}: ${value.mathText} ${value.display ? "(display)" : ""} ${value.insideCallout ? "(in callout)" : ""} ${value.overlap === undefined ? "(overlap not checked yet)" : value.overlap ? "(overlapping)" : "(non-overlapping)"}`);
    });
}

export function nodeTextQuoteSymbolTrimmed(node: SyntaxNodeRef, state: EditorState, quoteLevel: number): string | undefined {
    const quoteSymbolPattern = new RegExp(`((>\\s*){${quoteLevel}})(.*)`);
    const quoteSymbolMatch = nodeText(node, state).match(quoteSymbolPattern);
    if (quoteSymbolMatch) {
        return quoteSymbolMatch.slice(-1)[0];
    }
}

export function printChangeSet(changes: ChangeSet) {
    changes.iterChanges(
        (fromA, toA, fromB, toB, inserted) => {
            console.log(`${fromA}-${toA}: "${inserted.toString()}" inserted (${fromB}-${toB} in new state)`);
        }
    );
}

export function rangeSetSome<T extends RangeValue>(set: RangeSet<T>, predicate: (value: T, index: number, set: RangeSet<T>) => unknown) {
    const cursor = set.iter();
    let index = 0;
    while (cursor.value) {
        if (predicate(cursor.value, index, set)) {
            return true;
        }
        cursor.next();
        index++;
    }
    return false;
}

export function hasOverlap(range1: { from: number, to: number }, range2: { from: number, to: number }): boolean {
    return range1.from <= range2.to && range2.from <= range1.to;
}

export function rangesHaveOverlap(ranges: readonly SelectionRange[], from: number, to: number) {
    for (const range of ranges) {
        if (range.from <= to && range.to >= from)
            return true;
    }
    return false;
}
