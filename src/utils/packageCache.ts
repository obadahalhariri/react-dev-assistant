import * as vscode from 'vscode';

const cache = new Map<string, Record<string, string>>();

export function getCachedScripts(pkgUri: vscode.Uri): Record<string, string> | undefined {
    return cache.get(pkgUri.fsPath);
}

export async function refreshPackageScripts(pkgUri: vscode.Uri): Promise<void> {
    try {
        const path = pkgUri.fsPath;
        if (path.includes(`${require('path').sep}node_modules${require('path').sep}`)) {
            return;
        }

        const bytes = await vscode.workspace.fs.readFile(pkgUri);
        const content = new TextDecoder('utf8').decode(bytes);
        const manifest = JSON.parse(content);
        const scripts = manifest.scripts ?? {};
        cache.set(pkgUri.fsPath, scripts);
    } catch (err) {
        // on error, remove invalid cache entry
        cache.delete(pkgUri.fsPath);
    }
}

export function initPackageJsonWatcher(context: vscode.ExtensionContext) {
    const ws = vscode.workspace;
    const pattern = new vscode.RelativePattern(ws.workspaceFolders?.[0] ?? '', '**/package.json');

    const watcher = ws.createFileSystemWatcher('**/package.json', false, false, false);

    const onChange = (uri: vscode.Uri) => {
        void refreshPackageScripts(uri);
    };

    watcher.onDidCreate(onChange, null, context.subscriptions);
    watcher.onDidChange(onChange, null, context.subscriptions);
    watcher.onDidDelete((uri) => cache.delete(uri.fsPath), null, context.subscriptions);

    // Preload existing package.json files
    void (async () => {
        try {
            const pkgFiles = await ws.findFiles('**/package.json', '**/node_modules/**', 200);
            await Promise.all(pkgFiles.map(p => refreshPackageScripts(p)));
        } catch (err) {
            // ignore
        }
    })();

    context.subscriptions.push(watcher);
}
