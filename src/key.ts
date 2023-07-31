import { App, Editor } from 'obsidian';
import { generateBlockID } from 'utils';

export function insertInlineMath(editor: Editor) {
    let cursorPos = editor.getCursor();
    editor.replaceRange('${  }$', cursorPos);
    cursorPos.ch += 3;
    editor.setCursor(cursorPos);
}

export function insertDisplayMath(editor: Editor, number: boolean, app: App) {
    let cursorPos = editor.getCursor();
    const inQuoteOrCallout = editor.getLine(cursorPos.line).trimStart().startsWith('>');
    const quoteMark = inQuoteOrCallout ? '> ' : '';
    let insertText = '$$\n' + quoteMark + '\n' + quoteMark + '$$';
    if (number) {
        let id = generateBlockID(app);
        // insertText = '$$\n' + quoteMark + '\n' + quoteMark + '\\tag{@}\n' + quoteMark + '$$\n' + quoteMark + `^${id}`;
        insertText = '$$\n' + quoteMark + '\n' + quoteMark + '$$\n' + quoteMark + `^${id}`;
    }
    editor.replaceRange(insertText, cursorPos);
    cursorPos.line += 1;
    cursorPos.ch = quoteMark.length;
    editor.setCursor(cursorPos);
}

