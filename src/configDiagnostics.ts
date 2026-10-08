import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { claudeCodeMcpPath, vscodeUserMcpPath, windsurfMcpPath } from './config';
import { projectMcpJsonPaths } from './config-core';
import { lintMcpJsonRaw } from './config-lint';

const SOURCE = 'mcpWatchdog';

/**
 * vscode DiagnosticCollection glue for mcp.json structure lint (pure rules in config-lint.ts).
 */
export class ConfigDiagnostics implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(SOURCE);
  }

  refresh(): void {
    if (
      !vscode.workspace.getConfiguration('mcpWatchdog').get<boolean>('diagnostics.enabled', true)
    ) {
      this.collection.clear();
      return;
    }

    this.collection.clear();
    for (const filePath of configPaths()) {
      this.lintFile(filePath);
    }
  }

  private lintFile(filePath: string): void {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }

    const uri = vscode.Uri.file(filePath);
    const diagnostics = lintMcpJsonRaw(raw).map((d) => {
      const range = new vscode.Range(d.line, d.character, d.line, d.character + 1);
      const severity =
        d.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;
      const diag = new vscode.Diagnostic(range, d.message, severity);
      diag.source = SOURCE;
      return diag;
    });
    this.collection.set(uri, diagnostics);
  }

  dispose(): void {
    this.collection.dispose();
  }
}

function configPaths(): string[] {
  const home = os.homedir();
  const paths = [
    vscodeUserMcpPath(home),
    windsurfMcpPath(home),
    claudeCodeMcpPath(home),
    path.join(home, '.cursor', 'mcp.json'),
  ];
  const folders = vscode.workspace.workspaceFolders ?? [];
  paths.push(...projectMcpJsonPaths(folders.map((f) => f.uri.fsPath)));
  return paths;
}
