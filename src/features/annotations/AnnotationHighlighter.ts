import * as vscode from 'vscode';
import { AnnotationEvents, AnnotationItem } from './AnnotationEvents';

export class AnnotationHighlighter {
    private disposables: vscode.Disposable[] = [];
    private decorationType: vscode.TextEditorDecorationType;

    constructor() {
        const config = vscode.workspace.getConfiguration('todo');
        const color = config.get<string>('highlightColor', '#FFCC00');

        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
            border: `1px solid ${color}`,
            borderRadius: '2px',
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                contentText: ' ⬅ REVIEW',
                color,
                fontStyle: 'italic'
            }
        });

        // Listen to scan results
        AnnotationEvents.onScanCompleted((event) => {
            this.highlightItems(event.items);
        });

        // Highlight immediately in active editor
        if (vscode.window.activeTextEditor) {
            this.highlightEditor(vscode.window.activeTextEditor);
        }

        // Re-highlight on editor change
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.highlightEditor(editor);
            }
        });
    }

    private highlightItems(items: AnnotationItem[]) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const decorations: vscode.DecorationOptions[] = items
            .filter(item => item.fileUri.fsPath === editor.document.uri.fsPath)
            .map(item => ({
                range: new vscode.Range(item.line, item.column, item.line, item.column + item.tag.length),
                hoverMessage: `${item.tag}: ${item.message}`
            }));

        editor.setDecorations(this.decorationType, decorations);
    }

    private highlightEditor(editor: vscode.TextEditor) {
        // Optionally, trigger a fresh scan for this file
        // or use cached items from AnnotationEvents
        const items = AnnotationEvents.getLastScanItems?.() ?? [];
        this.highlightItems(items);
    }

    dispose() {
        // Dispose all registered disposables
        this.disposables.forEach(d => d.dispose());
    }
}
