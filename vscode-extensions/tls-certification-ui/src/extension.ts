// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CertificateManager } from '@rushstack/debug-certificate-manager';
import { ConsoleTerminalProvider, Terminal } from '@rushstack/terminal';

const consoleTerminalProvider: ConsoleTerminalProvider = new ConsoleTerminalProvider();

export const terminal: Terminal = new Terminal(consoleTerminalProvider);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  //const extensionConfiguration: vscode.WorkspaceConfiguration =
  //vscode.workspace.getConfiguration('tls-certification-ui');

  // terminal.writeLine(`Extension configuration: ${JSON.stringify(extensionConfiguration)}`);

  // const extensionLogLevel: LogLevel | undefined = extensionConfiguration.get('logLevel');
  // if (extensionLogLevel) {
  //   setLogLevel(extensionLogLevel);
  // }
  // vscode.window.showInformationMessage('TLS Cetification UI Extension is now active!');
  context.subscriptions.push(
    vscode.commands.registerCommand('rushstack.ensureDebugCertificate', async () => {
      const manager: CertificateManager = new CertificateManager();
      const { pemCaCertificate, pemCertificate, pemKey } = await manager.ensureCertificateAsync(
        true,
        terminal
      );

      terminal.writeLine(`pemCaCertificate: ${pemCaCertificate}`);
      terminal.writeLine(`pemCertificate: ${pemCertificate}`);
      terminal.writeLine(`pemKey: ${pemKey}`);

      if (pemCaCertificate && pemCertificate && pemKey) {
        await vscode.window.showInformationMessage('Certificate successfully generated');
      } else {
        await vscode.window.showErrorMessage('Certificate was not generated');
      }

      await vscode.commands.executeCommand(
        'rushstack.saveDebugCertificate',
        pemCaCertificate,
        pemCertificate,
        pemKey
      );
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate(): void {}
