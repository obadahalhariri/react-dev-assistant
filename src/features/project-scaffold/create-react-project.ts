import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execSync } from 'child_process';
import { spawn } from 'child_process';

/**
 * Validate project name.
 * Only allows letters, numbers, dash and underscore.
 */
const PROJECT_NAME_REGEX = /^[a-zA-Z0-9-_]+$/;

function validateProjectName(name: string): string | undefined {
    if (!name) {
        return "Project name is required";
    }
    if (name.length < 3) {
        return "Project name is too short";
    }
    if (!PROJECT_NAME_REGEX.test(name)) {
        return "Project name can only contain letters, numbers, dashes, or underscores";
    }

    return undefined; // no errors
}

async function selectTargetFolder(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const folderOptions: vscode.QuickPickItem[] = workspaceFolders.map((f) => ({
        label: f.name,
        description: f.uri.fsPath,
    }));
    folderOptions.push({
        label: "Browse...",
        description: "Select a custom folder",
    });

    const selected = await vscode.window.showQuickPick(folderOptions, {
        placeHolder: "Select target folder for the new React project",
    });

    if (!selected) {
        return undefined;
    } // user cancelled

    if (selected.label === "Browse...") {
        const folders = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: "Select target folder",
        });
        if (!folders || folders.length === 0) {
            return undefined;
        }
        return folders[0].fsPath;
    }

    return selected.description;
}

/**
 * Validate target folder.
 * Ensure folder is empty or allow overwrite confirmation
 */
async function validateFolder(projectFolder: string, projectName: string): Promise<boolean> {
    const targetPath = path.join(projectFolder, projectName);
    if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
        const choice = await vscode.window.showWarningMessage(
            `The folder "${targetPath}" is not empty. Do you want to overwrite it?`,
            { modal: true },
            "Overwrite",
            "Cancel"
        );
        if (choice !== "Overwrite") {
            return false;
        }
    }
    return true;
}

/**
 * Detect installed package managers
 */
function detectPackageManagers(): string[] {
    const managers = ['npm', 'yarn', 'pnpm'];
    return managers.filter(pm => {
        try {
            execSync(`${pm} --version`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    });
}

/**
 * Ask user to select package manager
 */
async function selectPackageManager(): Promise<string | undefined> {
    const availablePMs = detectPackageManagers();
    if (availablePMs.length === 0) {
        vscode.window.showErrorMessage('No package manager found. Please install npm, yarn, or pnpm.');
        return undefined;
    }

    const quickPickItems: vscode.QuickPickItem[] = availablePMs.map(pm => ({
        label: pm,
        description: pm === 'npm' ? 'Recommended' : ''
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select package manager'
    });

    return selected?.label;
}

/**
 * Ask user to select project language (JS or TS)
 */
async function selectProjectLanguage(): Promise<string | undefined> {
    const items: vscode.QuickPickItem[] = [
        {
            label: 'TypeScript',
            description: 'Recommended',
            detail: 'Uses the "react-ts" template'
        },
        {
            label: 'JavaScript',
            description: 'Standard',
            detail: 'Uses the "react" template'
        }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select project language'
    });

    if (!selected) {
        return undefined;
    }

    // Return the Vite template name based on selection
    return selected.label === 'TypeScript' ? 'react-ts' : 'react';
}

/**
 * Run create-vite command.
 * * FIX / BUG: Added double dash "--" for npm to correctly pass the template argument.
 */
function runCreateVite(pm: string, projectName: string, template: string) {
    if (pm === 'npm') {
        // FIX: npm requires ' -- ' to pass arguments like --template to the script
        return `npm create vite@latest "${projectName}" -- --template ${template}`;
    } else {
        // yarn and pnpm handle arguments directly
        return `${pm} create vite "${projectName}" --template ${template}`;
    }
}


/**
 * Output channel for logging
 */
const outputChannel = vscode.window.createOutputChannel('Bootstrapping Assistant');


/**
 * Run a shell command and stream output to the output channel
 */
function runCommand(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        // Shell option is true to handle complex command strings
        const process = spawn(command, { cwd, shell: true });

        process.stdout.on('data', (data) => {
            outputChannel.append(data.toString());
        });

        process.stderr.on('data', (data) => {
            outputChannel.append(data.toString());
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
    });
}



export async function createReactProject() {
    // 1. Ask for project name
    const projectName = await vscode.window.showInputBox({
        prompt: "Enter the React project name (kebab-case recommended)",
        placeHolder: "my-react-app",
        validateInput: validateProjectName,
    });
    if (!projectName) {
        vscode.window.showInformationMessage("Project creation cancelled.");
        return;
    }

    // 2. Ask for target folder
    const targetFolder = await selectTargetFolder();
    if (!targetFolder) {
        vscode.window.showInformationMessage("Project creation cancelled.");
        return;
    }
    const isValid = await validateFolder(targetFolder, projectName);
    if (!isValid) {
        vscode.window.showInformationMessage("Project creation cancelled.");
        return;
    }

    const fullProjectPath = path.join(targetFolder, projectName);

    // 3. Package manager
    const packageManager = await selectPackageManager();
    if (!packageManager) { return; }

    // 4. Ask for Language (JS vs TS)
    const templateName = await selectProjectLanguage();
    if (!templateName) {
        vscode.window.showInformationMessage("Project creation cancelled.");
        return;
    }

    // 5. Confirm and start creation
    const proceed = await vscode.window.showInformationMessage(
        `Ready to scaffold project "${projectName}" (${templateName === 'react-ts' ? 'TypeScript' : 'JavaScript'}) in "${fullProjectPath}" using ${packageManager}?`,
        //{ modal: true },
        "Create Project",
        "Cancel"
    );

    if (proceed !== 'Create Project') {
        vscode.window.showInformationMessage('Project creation cancelled.');
        return;
    }

    outputChannel.show(true);
    outputChannel.appendLine(`Starting project creation: ${projectName} [${templateName}]`);

    // 6. Run create-vite with the selected template
    const createCommand = runCreateVite(packageManager, projectName, templateName);

    // Debug log to verify command
    outputChannel.appendLine(`Running command: ${createCommand}`);

    try {
        await runCommand(createCommand, targetFolder);
        outputChannel.appendLine('✅ Vite project scaffolded successfully.');
    } catch (err: any) {
        vscode.window.showErrorMessage(`Project creation failed: ${err.message}`);
        outputChannel.appendLine(`❌ ${err.message}`);
        return;
    }

    // 7. Install dependencies (if needed)
    outputChannel.appendLine('Installing dependencies...');
    try {
        await runCommand(`${packageManager} install`, fullProjectPath);
        outputChannel.appendLine('✅ Dependencies installed successfully.');
    } catch (err: any) {
        vscode.window.showWarningMessage(`Dependency installation failed: ${err.message}`);
    }

    // 8. Optional: Git init
    const defaultGitSetting = vscode.workspace
        .getConfiguration('bootstrappingAssistant')
        .get('gitInit', true);

    const gitChoice = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        {
            placeHolder: `Initialize a Git repository? (Default: ${defaultGitSetting ? 'Yes' : 'No'})`
        }
    );

    const shouldInitGit =
        gitChoice === 'Yes' ||
        (gitChoice === undefined && defaultGitSetting);

    if (shouldInitGit) {
        try {
            outputChannel.appendLine('Initializing Git repository...');
            await runCommand('git init', fullProjectPath);
            outputChannel.appendLine('✓ Git repository initialized.');

            // Ask if the user wants to create the first commit
            const commitChoice = await vscode.window.showQuickPick(
                ['Yes', 'No'],
                {
                    placeHolder: 'Do you want to create the initial commit now?'
                }
            );

            if (commitChoice === 'Yes') {
                try {
                    await runCommand('git add .', fullProjectPath);
                    await runCommand('git commit -m "Initial commit"', fullProjectPath);
                    outputChannel.appendLine('✓ Initial commit created.');
                } catch {
                    outputChannel.appendLine('⚠ Failed to create the initial commit.');
                }
            } else {
                outputChannel.appendLine('ℹ Skipped creating the initial commit.');
            }

        } catch {
            outputChannel.appendLine('⚠ Git initialization skipped (git may not be installed).');
        }
    } else {
        outputChannel.appendLine('ℹ Git initialization skipped by user.');
    }

    // 9. Ask whether to open the new project in the same window
    const openChoice = await vscode.window.showInformationMessage(
        `🎉 React project "${projectName}" created successfully! Do you want to open it now?`,
        'Yes',
        'No'
    );

    if (openChoice === 'Yes') {
        try {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(fullProjectPath), false);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to open project folder: ${err?.message ?? String(err)}`);
            outputChannel.appendLine(`⚠ Failed to open project folder: ${err?.message ?? String(err)}`);
        }
    }

}
