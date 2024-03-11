// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CertificateStore } from '@rushstack/debug-certificate-manager';
import { ConsoleTerminalProvider, Terminal } from '@rushstack/terminal';

const consoleTerminalProvider: ConsoleTerminalProvider = new ConsoleTerminalProvider();

export const terminal: Terminal = new Terminal(consoleTerminalProvider);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  vscode.window.showInformationMessage('TLS Cetification Workspace Extension is now active!');

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rushstack.saveDebugCertificate',
      async (pemCaCertificate: string, pemCertificate: string, pemKey: string) => {
        const store: CertificateStore = new CertificateStore();

        store.caCertificateData = pemCaCertificate;
        store.certificateData = pemCertificate;
        store.keyData = pemKey;

        await vscode.window.showInformationMessage('Certificate successfully saved');
      }
    )
  );
}

// this method is called when your extension is deactivated
export function deactivate(): void {}
