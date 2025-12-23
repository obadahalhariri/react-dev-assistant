import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Integration Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        const extensionId = 'my-extension.react-dev-assistant';
        assert.ok(vscode.extensions.getExtension(extensionId), `Extension ${extensionId} not found`);
    });

    test('Commands should be registered', async () => {
        const extensionId = 'my-extension.react-dev-assistant';
        const ext = vscode.extensions.getExtension(extensionId);

        // 1. Ensure extension exists
        assert.ok(ext, 'Extension not found');

        // 2. ACTIVATE the extension explicitly
        // This ensures registerCommand() in activate() has actually run
        if (!ext.isActive) {
            await ext.activate();
        }

        // 3. Get all commands registered in VS Code
        const commands = await vscode.commands.getCommands(true);

        // 4. Assert your commands exist
        assert.ok(commands.includes('react-dev-assistant.createReactProject'), 'createReactProject command missing');
        assert.ok(commands.includes('react-dev-assistant.runScriptAssistant'), 'runScriptAssistant command missing');
        assert.ok(commands.includes('react-dev-assistant.openDocumentationHub'), 'openDocumentationHub command missing');
    });
});