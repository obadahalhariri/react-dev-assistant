import * as vscode from 'vscode';
import { AnnotationEvents, AnnotationItem } from './AnnotationEvents';

export class AnnotationScanner {
    private disposables: vscode.Disposable[] = [];
    private tags: string[];

    constructor() {
        const config = vscode.workspace.getConfiguration('todo');

        // Customizable tags
        this.tags = config.get<string[]>(
            'tags',
            ['TODO', 'FIXME', 'BUG', 'NOTE', 'HACK', 'OPTIMIZE', 'REVIEW', 'XXX', 'QUESTION', 'ISSUE']
        );
    }

    /**
     * Scan all workspace files for TODO/FIXME and custom tags
     */
    async scanWorkspace(): Promise<void> {
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx}',
            '**/{node_modules,dist,out,build,.git}/**', // Stricter excludes
            1000 // Limit to max 1000 files to prevent crashing large repos
        );

        const items: AnnotationItem[] = [];

        // Create ONE regex for all tags, case-insensitive
        const pattern = new RegExp(
            `\\b(${this.tags.join('|')})\\b`,
            'i'
        );

        for (const file of files) {
            const bytes = await vscode.workspace.fs.readFile(file);
            const text = new TextDecoder('utf8').decode(bytes);
            const lines = text.split(/\r?\n/);

            lines.forEach((line, lineIndex) => {
                const match = line.match(pattern);

                if (match) {
                    const tag = match[1]; // matched word (case-insensitive)
                    const col = match.index ?? 0;

                    items.push({
                        fileUri: file,
                        line: lineIndex,
                        column: col,
                        tag: tag.toUpperCase(),   // normalize for display
                        message: line.slice(col + tag.length).trim(),
                        rawLine: line
                    });
                }
            });
        }

        // Send event to tree + highlighter
        AnnotationEvents.fire({ items });
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
