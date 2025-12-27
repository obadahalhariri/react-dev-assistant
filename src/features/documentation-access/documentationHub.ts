import * as vscode from 'vscode';

/**
 * Registers all documentation-related commands and UI elements.
 */
export function registerDocumentationHub(context: vscode.ExtensionContext) {

    // 1. Register individual documentation link commands
    const docLinks: Record<string, string> = {
        openReactDocs: 'https://reactjs.org/docs/getting-started.html',
        openReactHooks: 'https://reactjs.org/docs/hooks-intro.html',
        openViteDocs: 'https://vitejs.dev/guide/',
        openJSXDocs: 'https://reactjs.org/docs/introducing-jsx.html',
        openTSXDocs: 'https://www.typescriptlang.org/docs/handbook/jsx.html',
        openESLintRules: 'https://eslint.org/docs/rules/',
        openReactTestingLibrary: 'https://testing-library.com/docs/react-testing-library/intro/',
        openNodeDocs: 'https://nodejs.org/en/docs/'
    };

    Object.entries(docLinks).forEach(([cmd, url]) => {
        const disposable = vscode.commands.registerCommand(`react-dev-assistant.${cmd}`, () => {
            vscode.env.openExternal(vscode.Uri.parse(url));
        });
        context.subscriptions.push(disposable);
    });

    // 2. Register "Open Documentation Hub" Command
    const documentationHubCommand = vscode.commands.registerCommand(
        'react-dev-assistant.openDocumentationHub',
        async () => {
            const groupedDocs: Record<string, { label: string; url: string }[]> = {
                React: [
                    { label: 'React Docs', url: 'https://reactjs.org/docs/getting-started.html' },
                    { label: 'React Hooks', url: 'https://reactjs.org/docs/hooks-intro.html' },
                    { label: 'JSX Docs', url: 'https://reactjs.org/docs/introducing-jsx.html' },
                    { label: 'TypeScript React (TSX) Docs', url: 'https://www.typescriptlang.org/docs/handbook/jsx.html' },
                ],
                Vite: [
                    { label: 'Vite Docs', url: 'https://vitejs.dev/guide/' },
                ],
                Tooling: [
                    { label: 'ESLint Rules', url: 'https://eslint.org/docs/rules/' },
                ],
                Testing: [
                    { label: 'React Testing Library', url: 'https://testing-library.com/docs/react-testing-library/intro/' },
                ],
                Node: [
                    { label: 'Node.js Docs', url: 'https://nodejs.org/en/docs/' },
                ]
            };

            const items: vscode.QuickPickItem[] = [];
            for (const group in groupedDocs) {
                // Add a visual separator for the category
                items.push({ label: `--- ${group} ---`, kind: vscode.QuickPickItemKind.Separator });

                // Add individual documentation links
                groupedDocs[group].forEach(doc => {
                    items.push({ label: doc.label, description: doc.url });
                });
            }

            const selection = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a documentation to open',
            });

            if (selection && selection.description) {
                vscode.env.openExternal(vscode.Uri.parse(selection.description));
            }
        }
    );

    context.subscriptions.push(documentationHubCommand);

    // 3. Status Bar Item
    const reactDocsStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    reactDocsStatusBar.text = 'React Docs';
    reactDocsStatusBar.tooltip = 'Open React Documentation';
    reactDocsStatusBar.command = 'react-dev-assistant.openReactDocs';
    reactDocsStatusBar.show();
    context.subscriptions.push(reactDocsStatusBar);
}
