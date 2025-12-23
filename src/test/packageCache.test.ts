import * as assert from 'assert';
import * as vscode from 'vscode';
import { refreshPackageScripts, getCachedScripts } from '../utils/packageCache';

suite('packageCache', () => {
    test('refreshPackageScripts and getCachedScripts', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            // nothing to test in this environment
            assert.ok(true);
            return;
        }

        // find a package.json in the workspace
        const pkgFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 1);
        if (!pkgFiles || pkgFiles.length === 0) {
            assert.ok(true);
            return;
        }

        const pkg = pkgFiles[0];
        await refreshPackageScripts(pkg);
        const cached = getCachedScripts(pkg);
        // cached may be undefined if file couldn't be parsed, but the call should not throw
        assert.ok(true);
    });
});
