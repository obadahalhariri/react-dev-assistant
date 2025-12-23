import * as vscode from 'vscode';

/**
 * Represents a single TODO/FIXME item
 */
export interface TodoItem {
    fileUri: vscode.Uri;
    line: number;
    column: number;
    tag: string; // TODO, FIXME, etc.
    message: string;
    rawLine: string;
}

/**
 * Result of a scan
 */
export interface ScanResult {
    items: TodoItem[];
}

/**
 * Event emitter for TODO scan completion
 */
class TodoEventEmitter {
    private emitter = new vscode.EventEmitter<ScanResult>();
    public readonly onScanCompleted = this.emitter.event;
    private lastItems: TodoItem[] = [];

    fire(result: ScanResult) {
        this.lastItems = result.items;
        this.emitter.fire(result);
    }

    getLastScanItems(): TodoItem[] {
        return this.lastItems;
    }
}

export const TodoEvents = new TodoEventEmitter();
