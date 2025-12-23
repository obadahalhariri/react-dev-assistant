import * as vscode from 'vscode';
import { TodoEvents, TodoItem } from './todoEvents';
/**
 * Tree item representing a single TODO/FIXME
 */
export class TodoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly item: TodoItem
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
export class TodoTreeItemGroup extends vscode.TreeItem {
    constructor(
        public readonly fileUri: vscode.Uri,
        public readonly children: TodoTreeItem[]
    ) {
        super(vscode.workspace.asRelativePath(fileUri), vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = fileUri.fsPath;
        this.iconPath = vscode.ThemeIcon.File;
    }
}

export class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoTreeItem | TodoTreeItemGroup> {
    private _onDidChangeTreeData: vscode.EventEmitter<TodoTreeItem | TodoTreeItemGroup | undefined> = new vscode.EventEmitter<TodoTreeItem | TodoTreeItemGroup | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | TodoTreeItemGroup | undefined> = this._onDidChangeTreeData.event;

    private items: TodoItem[] = [];

    constructor() {
        // Listen for scanner events
        TodoEvents.onScanCompleted(event => {
            this.items = event.items;
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TodoTreeItem | TodoTreeItemGroup): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TodoTreeItemGroup | TodoTreeItem): Thenable<(TodoTreeItem | TodoTreeItemGroup)[]> {
        if (!element) {
            // top-level: group by file
            const groupsMap = new Map<string, TodoTreeItem[]>();

            for (const item of this.items) {
                const key = item.fileUri.fsPath;
                if (!groupsMap.has(key)) {
                    groupsMap.set(key, []);
                }
                groupsMap.get(key)?.push(new TodoTreeItem(item));
            }

            const groups: TodoTreeItemGroup[] = [];
            for (const [filePath, children] of groupsMap) {
                groups.push(new TodoTreeItemGroup(vscode.Uri.file(filePath), children));
            }

            // Return file groups...
            return Promise.resolve(groups);
        } else if (element instanceof TodoTreeItemGroup) {
            // children are individual TODOs
            return Promise.resolve(element.children);
        } else {
            return Promise.resolve([]);
        }
    }
}
