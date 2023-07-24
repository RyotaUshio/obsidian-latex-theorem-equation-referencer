import { Editor } from 'obsidian';

export function insertInlineMath(editor: Editor) {
    let cursorPos = editor.getCursor();
    editor.replaceRange('${  }$', cursorPos);
    cursorPos.ch += 3;
    editor.setCursor(cursorPos);
}

export function insertDisplayMath(editor: Editor) {
    let cursorPos = editor.getCursor();
    const inQuoteOrCallout = editor.getLine(cursorPos.line).trimStart().startsWith('>');
    const quoteMark = inQuoteOrCallout ? '> ' : '';
    editor.replaceRange('$$\n' + quoteMark + '\n' + quoteMark + '$$', cursorPos);
    cursorPos.line += 1;
    cursorPos.ch = quoteMark.length;
    editor.setCursor(cursorPos);
}

