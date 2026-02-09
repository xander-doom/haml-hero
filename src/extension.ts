import * as vscode from "vscode";
import { formatHamlDocument, setExtensionContext as setFormatterContext } from "./formatter";
import {
  updateDiagnostics,
  clearDiagnostics,
  clearAllDiagnostics,
  setExtensionContext as setDiagnosticsContext,
} from "./diagnostics";

let diagnosticsTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Pass extension context to modules
  setFormatterContext(context);
  setDiagnosticsContext(context);

  // Register document formatting provider
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("haml", {
      async provideDocumentFormattingEdits(document: vscode.TextDocument) {
        const result = await formatHamlDocument(document);
        await updateDiagnostics(document);
        return result;
      },
    })
  );

  // Update diagnostics on file open
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  // Update diagnostics when switching files
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDiagnostics(editor.document);
      }
    })
  );

  // Update diagnostics on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      updateDiagnostics(document);
    })
  );

  // Update diagnostics on file change (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "haml") {
        if (diagnosticsTimeout) {
          clearTimeout(diagnosticsTimeout);
        }
        diagnosticsTimeout = setTimeout(() => {
          updateDiagnostics(event.document);
        }, 500);
      }
    })
  );

  // Clear diagnostics when file is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      clearDiagnostics(document.uri);
    })
  );
}

export function deactivate() {
  if (diagnosticsTimeout) {
    clearTimeout(diagnosticsTimeout);
  }
  clearAllDiagnostics();
}
