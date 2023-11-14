import { Editor } from 'obsidian';

/**
 * Correctly insert a display math even inside callouts or quotes.
 */
export function insertDisplayMath(editor: Editor) {
    const cursorPos = editor.getCursor();
    const line = editor.getLine(cursorPos.line).trimStart();
    const nonQuoteMatch = line.match(/[^>\s]/);

    const head = nonQuoteMatch?.index ?? line.length;
    const quoteLevel = line.slice(0, head).match(/>\s*/g)?.length ?? 0;
    let insert = "$$\n" + "> ".repeat(quoteLevel) + "\n" + "> ".repeat(quoteLevel) + "$$";

    editor.replaceRange(insert, cursorPos);
    cursorPos.line += 1;
    cursorPos.ch = quoteLevel * 2;
    editor.setCursor(cursorPos);
}