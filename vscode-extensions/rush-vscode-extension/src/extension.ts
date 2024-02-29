// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { type LogLevel, setLogLevel, terminal } from './logic/logger';
import { RushWorkspace } from './logic/RushWorkspace';
import { RushProjectsProvider } from './providers/RushProjectsProvider';
import { RushTaskProvider } from './providers/TaskProvider';
import { RushCommandWebViewPanel } from './logic/RushCommandWebViewPanel';
import { FileSystem } from '@rushstack/node-core-library';
import { CertificateManager, type ICertificate } from '@rushstack/debug-certificate-manager';
import { homedir } from 'node:os';
import * as path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  vscode.window.showInformationMessage('Rush Stack extension is now active!');
  context.subscriptions.push(
    vscode.commands.registerCommand('rushstack.selectWorkspace', async () => {
      await RushWorkspace.selectWorkspace();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('rushstack.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'rushstack');
    })
  );

  const extensionConfiguration: vscode.WorkspaceConfiguration =
    vscode.workspace.getConfiguration('rushstack');

  terminal.writeLine(`Extension configuration: ${JSON.stringify(extensionConfiguration)}`);

  const extensionLogLevel: LogLevel | undefined = extensionConfiguration.get('logLevel');
  if (extensionLogLevel) {
    setLogLevel(extensionLogLevel);
  }

  const workspaceFolderPaths: string[] = vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath) || [];
  const rushWorkspace: RushWorkspace | undefined =
    await RushWorkspace.initializeFromWorkspaceFolderPathsAsync(workspaceFolderPaths);
  if (rushWorkspace) {
    const rushProjectsProvider: RushProjectsProvider = new RushProjectsProvider(context);
    // Projects Tree View
    vscode.window.createTreeView('rushProjects', {
      treeDataProvider: rushProjectsProvider
    });
    vscode.tasks.registerTaskProvider('rushstack', RushTaskProvider.getInstance());

    // const rushCommandsProvider: RushCommandsProvider = new RushCommandsProvider(context);
    // // Rush Commands TreeView
    // vscode.window.createTreeView('rushCommands', {
    //   treeDataProvider: rushCommandsProvider
    // });
    // context.subscriptions.push(
    //   vscode.commands.registerCommand('rushstack.refresh', async () => {
    //     const workspaceFolderPaths: string[] =
    //       vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath) || [];
    //     await RushWorkspace.initializeFromWorkspaceFolderPathsAsync(workspaceFolderPaths);
    //   })
    // );

    RushCommandWebViewPanel.initialize(context).reveal();
  }

  const certificateManager: CertificateManager = new CertificateManager();

  // logger.terminal.writeLine(`Untrusting existing CA certificate`);
  // await certificateManager.untrustCertificateAsync(logger.terminal);

  terminal.writeLine(`Obtaining a TLS certificate signed by a local self-signed Certificate Authority`);

  const {
    pemCaCertificate,
    pemCertificate,
    pemKey
  }: ICertificate & {
    pemCaCertificate?: string;
  } = await certificateManager.ensureCertificateAsync(true, terminal);

  if (!pemCertificate || !pemKey) {
    throw new Error(`No certificate available, exiting.`);
  }
  terminal.writeLine(`Trusted TLS certificate successfully obtained`);

  const unresolvedUserFolder: string = homedir();
  const userProfilePath: string = path.resolve(unresolvedUserFolder);
  if (!FileSystem.exists(userProfilePath)) {
    throw new Error("Unable to determine the current user's home directory");
  }

  const serveDataPath: string = path.join(userProfilePath, '.rushstack');
  FileSystem.ensureFolder(serveDataPath);

  const caCertificatePath: string = path.join(serveDataPath, 'rushstack-ca.pem');
  const certificatePath: string = path.join(serveDataPath, 'rushstack-serve.pem');
  const keyPath: string = path.join(serveDataPath, 'rushstack-serve.key');

  if (pemCaCertificate) {
    await FileSystem.writeFileAsync(caCertificatePath, pemCaCertificate);
  }

  await FileSystem.writeFileAsync(certificatePath, pemCertificate);
  await FileSystem.writeFileAsync(keyPath, pemKey);
}

// this method is called when your extension is deactivated
export function deactivate(): void {}
