import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
  private channel: vscode.LogOutputChannel;

  constructor() {
    this.channel = vscode.window.createOutputChannel('MCP Watchdog', { log: true });
  }

  info(msg: string): void {
    this.channel.info(msg);
  }

  warn(msg: string): void {
    this.channel.warn(msg);
  }

  error(msg: string): void {
    this.channel.error(msg);
  }

  getLogFn(): (msg: string) => void {
    return (msg) => this.info(msg);
  }

  show(): void {
    this.channel.show();
  }

  dispose(): void {
    this.channel.dispose();
  }
}
