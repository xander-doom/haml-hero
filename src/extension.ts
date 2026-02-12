import * as vscode from "vscode";
import { formatHamlDocument, formatDocumentInBackground, isFormattingInProgress, setExtensionContext as setFormatterContext } from "./formatter";
import {
  updateDiagnostics,
  clearDiagnostics,
  clearAllDiagnostics,
  setExtensionContext as setDiagnosticsContext,
} from "./diagnostics";
import { getHamlLintConfig } from "./hamlLint";
import { HamlCodeActionProvider, disableLinterGlobally, disableRule } from "./codeActions";

let diagnosticsTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Pass extension context to modules
  setFormatterContext(context);
  setDiagnosticsContext(context);

  // Register code action provider for quick fixes
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "haml",
      new HamlCodeActionProvider(),
      { providedCodeActionKinds: HamlCodeActionProvider.providedCodeActionKinds }
    )
  );

  // Register command to disable linter in project .haml-lint.yml
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "hamlHero.disableRule",
      disableRule
    )
  );

  // Register command to disable linter globally in user settings
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "hamlHero.disableLinterGlobally",
      disableLinterGlobally
    )
  );

  // Register command to refresh diagnostics
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "hamlHero.refreshDiagnostics",
      (document: vscode.TextDocument) => {
        if (document && document.languageId === "haml") {
          updateDiagnostics(document);
        }
      }
    )
  );

  // Register document formatting provider
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("haml", {
      async provideDocumentFormattingEdits(document: vscode.TextDocument) {
        const { formatInBackground } = getHamlLintConfig();
        const result = await formatHamlDocument(document);
        // Skip diagnostics here when background formatting is enabled - they'll run on save
        if (!formatInBackground) {
          await updateDiagnostics(document);
        }
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

  // Update diagnostics on file save and trigger background formatting
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === "haml" && !isFormattingInProgress(document.uri)) {
        // Run background formatting (will re-save after formatting)
        formatDocumentInBackground(document);
      }
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
