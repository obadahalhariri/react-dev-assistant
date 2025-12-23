import * as vscode from 'vscode';
import { createReactProject } from './features/project-scaffold/create-react-project';
import { runScriptAssistant } from './features/script-assistant/run-script-assistant';
import { TodoScanner, TodoHighlighter, TodoTreeDataProvider } from './features/todo';
import { initPackageJsonWatcher } from './utils/packageCache';
import { registerDocumentationHub } from './features/documentation/documentationHub';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "react-dev-assistant" is now active!');

	// -----------------------
	// Feature 1: React Project Bootstrapping
	// -----------------------
	const createProjectCommand = vscode.commands.registerCommand(
		'react-dev-assistant.createReactProject',
		async () => {
			await createReactProject();
		}
	);

	// -----------------------
	// Feature 2: Script Runner
	// -----------------------
	const runScriptCommand = vscode.commands.registerCommand(
		'react-dev-assistant.runScriptAssistant',
		async () => {
			await runScriptAssistant();
		}
	);

	context.subscriptions.push(createProjectCommand, runScriptCommand);

	// Initialize package.json watcher and scripts cache
	initPackageJsonWatcher(context);

	// -----------------------
	// Feature 3: TODO/FIXME Management
	// -----------------------

	// Initialize scanner
	const scanner = new TodoScanner();
	context.subscriptions.push(scanner);
	scanner.scanWorkspace();

	// Rescan on file save
	vscode.workspace.onDidSaveTextDocument((document) => {
		if (
			document.uri.fsPath.endsWith('.ts') ||
			document.uri.fsPath.endsWith('.tsx') ||
			document.uri.fsPath.endsWith('.js') ||
			document.uri.fsPath.endsWith('.jsx')
		) {
			scanner.scanWorkspace();
		}
	});

	// Initialize highlighter
	const highlighter = new TodoHighlighter();
	context.subscriptions.push(highlighter);

	// Initialize tree view
	const treeDataProvider = new TodoTreeDataProvider();
	const treeView = vscode.window.createTreeView('todoTreeView', {
		treeDataProvider
	});
	context.subscriptions.push(treeView);

	// -----------------------
	// Feature 4: Documentation Access
	// -----------------------
	registerDocumentationHub(context);
}

export function deactivate() { }
