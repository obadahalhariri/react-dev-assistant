import * as vscode from 'vscode';
import { AnnotationEvents, AnnotationItem } from './AnnotationEvents';
/**
 * Tree item representing a single TODO/FIXME
 */
export class AnnotationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly item: AnnotationItem
    ) {
        super(`${item.tag}: ${item.message}`, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${item.tag}: ${item.message}\n${item.fileUri.fsPath}:${item.line + 1}`;
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [item.fileUri, { selection: new vscode.Range(item.line, item.column, item.line, item.column + item.tag.length) }]
        };
        this.iconPath = new vscode.ThemeIcon('check'); // optional icon
    }
}

/**
 * Tree item representing a file group
 */
export class AnnotationTreeItemGroup extends vscode.TreeItem {
    constructor(
        public readonly fileUri: vscode.Uri,
        public readonly children: AnnotationTreeItem[]
    ) {
        super(vscode.workspace.asRelativePath(fileUri), vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = fileUri.fsPath;
        this.iconPath = vscode.ThemeIcon.File;
    }
}

export class AnnotationTreeDataProvider implements vscode.TreeDataProvider<AnnotationTreeItem | AnnotationTreeItemGroup> {
    private _onDidChangeTreeData: vscode.EventEmitter<AnnotationTreeItem | AnnotationTreeItemGroup | undefined> = new vscode.EventEmitter<AnnotationTreeItem | AnnotationTreeItemGroup | undefined>();
    readonly onDidChangeTreeData: vscode.Event<AnnotationTreeItem | AnnotationTreeItemGroup | undefined> = this._onDidChangeTreeData.event;

    private items: AnnotationItem[] = [];

    constructor() {
        // Listen for scanner events
        AnnotationEvents.onScanCompleted(event => {
            this.items = event.items;
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: AnnotationTreeItem | AnnotationTreeItemGroup): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AnnotationTreeItemGroup | AnnotationTreeItem): Thenable<(AnnotationTreeItem | AnnotationTreeItemGroup)[]> {
        if (!element) {
            // top-level: group by file
            const groupsMap = new Map<string, AnnotationTreeItem[]>();

            for (const item of this.items) {
                const key = item.fileUri.fsPath;
                if (!groupsMap.has(key)) {
                    groupsMap.set(key, []);
                }
                groupsMap.get(key)?.push(new AnnotationTreeItem(item));
            }

            const groups: AnnotationTreeItemGroup[] = [];
            for (const [filePath, children] of groupsMap) {
                groups.push(new AnnotationTreeItemGroup(vscode.Uri.file(filePath), children));
            }

            // Return file groups...
            return Promise.resolve(groups);
        } else if (element instanceof AnnotationTreeItemGroup) {
            // children are individual Annotations under the file group
            return Promise.resolve(element.children);
        } else {
            return Promise.resolve([]);
        }
    }
}
