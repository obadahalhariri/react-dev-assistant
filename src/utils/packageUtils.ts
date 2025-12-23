import * as vscode from 'vscode';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Detect the package manager for a given folder by looking for lockfiles.
 * Preference order: pnpm, yarn, npm. Falls back to `npm`.
 */
export async function detectPackageManager(folderUri: vscode.Uri): Promise<PackageManager> {
    const ws = vscode.workspace;

    try {
        const pnpm = await ws.findFiles(new vscode.RelativePattern(folderUri.fsPath, 'pnpm-lock.yaml'), '**/node_modules/**', 1);
        if (pnpm.length > 0) { return 'pnpm'; }

        const yarn = await ws.findFiles(new vscode.RelativePattern(folderUri.fsPath, 'yarn.lock'), '**/node_modules/**', 1);
        if (yarn.length > 0) { return 'yarn'; }

        const npm = await ws.findFiles(new vscode.RelativePattern(folderUri.fsPath, 'package-lock.json'), '**/node_modules/**', 1);
        if (npm.length > 0) { return 'npm'; }
    } catch (err) {
        // If detection fails for any reason, fall back to npm
        console.warn('detectPackageManager error:', err);
    }

    return 'npm';
}

/**
 * Build the command string to run a script for the given package manager.
 * If `args` is provided it will be appended using the appropriate separator (`--`).
 */
export function getRunCommand(pm: PackageManager, scriptName: string, args?: string): string {
    const safeArgs = args?.trim();
    if (pm === 'npm' || pm === 'pnpm') {
        return safeArgs ? `${pm} run ${scriptName} -- ${safeArgs}` : `${pm} run ${scriptName}`;
    }

    // yarn: use `yarn run` for consistency across yarn versions
    return safeArgs ? `yarn run ${scriptName} -- ${safeArgs}` : `yarn run ${scriptName}`;
}
