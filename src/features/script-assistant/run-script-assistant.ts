import * as vscode from 'vscode';
import * as path from 'path';
import * as childProcess from 'child_process';
import { detectPackageManager, getRunCommand } from '../../utils/packageUtils';
import { getCachedScripts, refreshPackageScripts } from '../../utils/packageCache';


/**
 * Run Script Assistant command (initial scaffold).
 * - Finds package.json files in the workspace
 * - Lets the user pick a script via QuickPick
 * - Runs the selected script using `npm run <script>` in an integrated terminal
 */
export async function runScriptAssistant(): Promise<void> {
    const { window, workspace } = vscode;

    const folders = workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        void window.showErrorMessage('Open a workspace folder to run scripts.');
        return;
    }

    // Find package.json files in workspace (ignore node_modules)
    const pkgFiles = await workspace.findFiles('**/package.json', '**/node_modules/**', 50);
    if (!pkgFiles || pkgFiles.length === 0) {
        void window.showErrorMessage('No package.json found in the workspace.');
        return;
    }

    // Prefer package.json near the active editor if possible
    const activeUri = window.activeTextEditor?.document.uri;
    let pkgUri = pkgFiles[0];
    if (activeUri) {
        const activePath = activeUri.fsPath.replace(/\\/g, '/');
        const nearest = pkgFiles.find(p => activePath.startsWith(p.fsPath.replace(/\\/g, '/')));
        if (nearest) { pkgUri = nearest; }
    }

    // If multiple package.json files were found, present a quick pick to choose
    if (pkgFiles.length > 1) {
        const picks = pkgFiles.map(p => ({ label: workspace.asRelativePath(p), uri: p }));
        const chosenLabel = await window.showQuickPick(picks.map(p => p.label), { placeHolder: 'Select package.json to use' });
        if (!chosenLabel) { return; }
        const found = picks.find(p => p.label === chosenLabel);
        if (found) { pkgUri = found.uri; }
    }

    // Prefer cached scripts when available (watcher keeps cache up-to-date)
    let scripts = getCachedScripts(pkgUri);
    if (!scripts) {
        // try to refresh cache for this package.json
        await refreshPackageScripts(pkgUri);
        scripts = getCachedScripts(pkgUri);
    }

    // Fallback to reading package.json directly if cache is empty
    if (!scripts) {
        let content: string;
        try {
            const bytes = await workspace.fs.readFile(pkgUri);
            content = new TextDecoder('utf8').decode(bytes);
        } catch (err) {
            void window.showErrorMessage('Failed to read package.json: ' + String(err));
            return;
        }

        let manifest: any;
        try {
            manifest = JSON.parse(content);
        } catch (err) {
            void window.showErrorMessage('package.json is not valid JSON: ' + String(err));
            void workspace.openTextDocument(pkgUri).then(doc => window.showTextDocument(doc));
            return;
        }

        scripts = manifest.scripts ?? {};
    }
    const scriptNames = Object.keys(scripts || {});
    if (scriptNames.length === 0) {
        void window.showInformationMessage('No scripts found in package.json.');
        void workspace.openTextDocument(pkgUri).then(doc => window.showTextDocument(doc));
        return;
    }

    const items: vscode.QuickPickItem[] = scriptNames.map(name => ({ label: name, description: scripts ? scripts[name] : '' }));
    const selection = await window.showQuickPick(items, { placeHolder: 'Select a script to run' });
    if (!selection) { return; }

    const script = selection.label;
    const originalScriptCommand = scripts ? scripts[script] : '';

    // Helper: detect env-var prefix like VAR=value at the start of the script
    const hasEnvPrefix = (cmdStr: string) => {
        if (!cmdStr) { return false; }
        // match patterns like KEY=VALUE or KEY="VALUE"
        return /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(cmdStr);
    };

    // Helper: basic tokenization and quoting for args
    const escapeArgs = (argsStr: string) => {
        if (!argsStr) { return ''; }
        // split on spaces but respect quoted substrings
        const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
        const tokens = argsStr.match(re) || [];
        const escaped = tokens.map(t => {
            // if token contains whitespace and isn't already quoted, wrap in double quotes
            if (/\s/.test(t) && !/^['"].*['"]$/.test(t)) {
                return `"${t.replace(/"/g, '\\"')}"`;
            }
            return t;
        });
        return escaped.join(' ');
    };

    // Present options: Run, Run with args, Edit, Copy
    const action = await window.showQuickPick([
        { label: 'Run', description: 'Run without additional arguments' },
        { label: 'Run with args', description: 'Provide additional arguments' },
        { label: 'Edit script', description: 'Open package.json at the selected script' },
        { label: 'Copy command', description: 'Copy the resulting command to clipboard' }
    ], { placeHolder: `Action for script ${script}` });
    if (!action) { return; }

    // Resolve folder and detect package manager
    const folderPath = path.dirname(pkgUri.fsPath);
    const folderUri = vscode.Uri.file(folderPath);
    const pm = await detectPackageManager(folderUri);

    let args: string | undefined;
    if (action.label === 'Run with args') {
        args = await window.showInputBox({ prompt: `Arguments for ${script} (will be appended after '--')`, placeHolder: '--port 3000' });
        if (args === undefined) { return; } // cancelled
        args = escapeArgs(args);
    }

    // Build default command (npm/yarn/pnpm run ...)
    let cmd = getRunCommand(pm, script, args);

    // On Windows, detect env-var prefixes inside the script command and offer alternatives
    if (process.platform === 'win32' && originalScriptCommand && hasEnvPrefix(originalScriptCommand)) {
        const envChoice = await window.showQuickPick([
            { label: 'Run anyway', description: 'Attempt to run in the default shell' },
            { label: 'Run in Bash', description: 'Run using bash (Git Bash / WSL) if available' },
            { label: 'Run via npx cross-env', description: 'Use npx to run the script with cross-env to set env vars' }
        ], { placeHolder: 'Script appears to set environment variables — choose how to run on Windows' });
        if (!envChoice) { return; }

        if (envChoice.label === 'Run in Bash') {
            // Check whether `bash` is available on PATH
            const isBashAvailable = (() => {
                try {
                    const res = childProcess.spawnSync('bash', ['--version'], { stdio: 'ignore' });
                    return !!(res && res.status === 0);
                } catch (e) {
                    return false;
                }
            })();

            if (isBashAvailable) {
                // run npm run <script> inside bash
                const bashCmd = cmd; // same command but executed in bash shell
                const terminalNameBash = `Run Script Assistant (bash) (${path.basename(folderPath)})`;
                let terminalBash = window.terminals.find(t => t.name === terminalNameBash);
                if (!terminalBash) {
                    terminalBash = window.createTerminal({ name: terminalNameBash, cwd: folderPath, shellPath: 'bash', shellArgs: ['-lc'] });
                }
                terminalBash.show(true);
                terminalBash.sendText(bashCmd, true);
                return;
            }

            // Bash not found — offer alternatives
            const alt = await window.showQuickPick([
                { label: 'Run anyway', description: 'Run using the default shell' },
                { label: 'Run via npx cross-env', description: 'Use npx cross-env to set env vars' },
                { label: 'Cancel', description: '' }
            ], { placeHolder: 'bash not found on PATH — choose an alternative' });
            if (!alt || alt.label === 'Cancel') { return; }

            if (alt.label === 'Run via npx cross-env') {
                const appendedArgs = args ? ` ${args}` : '';
                cmd = `npx cross-env ${originalScriptCommand}${appendedArgs}`;
            }

            // if 'Run anyway', leave cmd as-is and continue to run in default shell below
        }

        if (envChoice.label === 'Run via npx cross-env') {
            // Execute the raw script command via npx cross-env <script...>
            // This constructs: npx cross-env <originalScriptCommand> [args]
            const appendedArgs = args ? ` ${args}` : '';
            cmd = `npx cross-env ${originalScriptCommand}${appendedArgs}`;
        }
        // if 'Run anyway', leave cmd as-is
    }

    if (action.label === 'Edit script') {
        const doc = await workspace.openTextDocument(pkgUri);
        const editor = await window.showTextDocument(doc);
        const text = doc.getText();
        const idx = text.indexOf(`"${script}"`);
        if (idx >= 0) {
            const pos = doc.positionAt(idx);
            editor.revealRange(new vscode.Range(pos, pos));
            editor.selection = new vscode.Selection(pos, pos);
        }
        return;
    }

    if (action.label === 'Copy command') {
        await vscode.env.clipboard.writeText(cmd);
        void window.showInformationMessage('Command copied to clipboard');
        return;
    }

    // Confirm and run
    //const run = await window.showInformationMessage(`Run: ${cmd}`, 'Run', 'Cancel');
    //if (run !== 'Run') { return; }

    const terminalName = `Run Script Assistant (${path.basename(folderPath)})`;
    let terminal = window.terminals.find(t => t.name === terminalName);
    if (!terminal) {
        terminal = window.createTerminal({ name: terminalName, cwd: folderPath });
    }
    terminal.show(true);
    terminal.sendText(cmd, true); // 'true' triggers the enter key
}
