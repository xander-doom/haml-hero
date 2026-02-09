import * as vscode from "vscode";
import {
  setExtensionContext as setHamlLintContext,
  runHamlLint,
  getWorkspaceInfo,
  getHamlLintConfig,
  getHamlLintConfigPath,
} from "./hamlLint";

export function setExtensionContext(context: vscode.ExtensionContext): void {
  setHamlLintContext(context);
}

export async function formatHamlDocument(
  document: vscode.TextDocument
): Promise<vscode.TextEdit[] | null> {
  const { enableFormatting } = getHamlLintConfig();
  if (!enableFormatting) {
    return null;
  }

  const { cwd } = getWorkspaceInfo(document);
  if (!cwd) {
    vscode.window.showErrorMessage(
      "HAML Hero: Cannot determine workspace folder"
    );
    return null;
  }

  const { linterPath, additionalFormatterArguments } = getHamlLintConfig();
  const configPath = await getHamlLintConfigPath(
    vscode.workspace.getWorkspaceFolder(document.uri)
  );

  try {
    const result = await runHamlLint(document.getText(), document.fileName, {
      autoCorrect: true,
      cwd,
      configPath,
      linterPath,
      additionalArgs: additionalFormatterArguments,
    });

    if (result.formattedContent && result.formattedContent !== document.getText()) {
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      return [vscode.TextEdit.replace(fullRange, result.formattedContent)];
    }

    return null;
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes("not found") || message.includes("ENOENT") || error.code === 127) {
      vscode.window.showErrorMessage(
        "HAML Hero: haml-lint not found. Install with: gem install haml_lint"
      );
    } else {
      vscode.window.showErrorMessage(`HAML Hero: Formatting failed: ${message}`);
    }
    return null;
  }
}