import { App, Editor } from 'obsidian';


export function insertInlineMath(editor: Editor) {
    const cursorPos = editor.getCursor();
    editor.replaceRange('${  }$', cursorPos);
    cursorPos.ch += 3;
    editor.setCursor(cursorPos);
}

export function insertDisplayMath(editor: Editor, app: App) {
    const cursorPos = editor.getCursor();
    const inQuoteOrCallout = editor.getLine(cursorPos.line).trimStart().startsWith('>');
    const quoteMark = inQuoteOrCallout ? '> ' : '';
    const insertText = '$$\n' + quoteMark + '\n' + quoteMark + '$$';
    editor.replaceRange(insertText, cursorPos);
    cursorPos.line += 1;
    cursorPos.ch = quoteMark.length;
    editor.setCursor(cursorPos);
}

