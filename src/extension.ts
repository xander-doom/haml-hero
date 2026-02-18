import * as vscode from "vscode";
import { formatHamlDocument, setExtensionContext as setFormatterContext } from "./formatter";
import {
  updateDiagnostics,
  clearDiagnostics,
  clearAllDiagnostics,
  setExtensionContext as setDiagnosticsContext,
} from "./diagnostics";
import { getHamlLintConfig, setExtensionContext as setLintContext, regenerateHamlLintConfig } from "./hamlLint";
import { 
  HamlCodeActionProvider, 
  disableLinterGlobally, 
  disableRule,
  disableRubocopRule,
  disableRubocopRuleGlobally,
  setRegenerateConfigCallback
} from "./codeActions";

let diagnosticsTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Pass extension context to modules
  setFormatterContext(context);
  setDiagnosticsContext(context);
  setLintContext(context);
  
  // Set callback for config regeneration
  setRegenerateConfigCallback(regenerateHamlLintConfig);

  // Register code action provider for quick fixes
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "haml",
      new HamlCodeActionProvider(),
      { providedCodeActionKinds: HamlCodeActionProvider.providedCodeActionKinds }
    )
  );

  // Register internal commands for haml-lint rule disabling (hidden from command palette)
  // Internal commands (prefixed with _) only appear in quick actions, not in command palette
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "_hamlHero.disableRule",
      disableRule
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "_hamlHero.disableLinterGlobally",
      disableLinterGlobally
    )
  );

  // Register internal commands for RuboCop rule disabling (hidden from command palette)
  // Internal commands (prefixed with _) only appear in quick actions, not in command palette
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "_hamlHero.disableRubocopRule",
      disableRubocopRule
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "_hamlHero.disableRubocopRuleGlobally",
      disableRubocopRuleGlobally
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
