import * as vscode from 'vscode';

/**
 * Represents a single TODO/FIXME item
 */
export interface AnnotationItem {
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
    items: AnnotationItem[];
}

/**
 * Event emitter for Annotation scan completion
 */
class AnnotationEventEmitter {
    private emitter = new vscode.EventEmitter<ScanResult>();
    public readonly onScanCompleted = this.emitter.event;
    private lastItems: AnnotationItem[] = [];

    fire(result: ScanResult) {
        this.lastItems = result.items;
        this.emitter.fire(result);
    }

    getLastScanItems(): AnnotationItem[] {
        return this.lastItems;
    }
}

export const AnnotationEvents = new AnnotationEventEmitter();
