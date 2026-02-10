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
    const errorMessage = error.message || String(error);
    if (errorMessage.includes("command not found") || 
        errorMessage.includes("ENOENT") ||
        errorMessage.includes("not found") ||
        error.code === "ENOENT" ||
        error.code === 127) {
      vscode.window.showErrorMessage(
        `haml-lint not found. Please install it with 'gem install haml_lint' or configure the path in settings (hamlHero.linterPath).`
      );
    } else if (errorMessage.includes("No version is set for command") || 
               errorMessage.includes("tool-versions") ||
               errorMessage.includes("ruby-version")) {
      vscode.window.showErrorMessage(
        `haml-lint requires a Ruby version to be set. Please configure your Ruby version manager (asdf, rbenv, etc.) for this project.`
      );
    } else if (errorMessage.includes("Gemfile") || errorMessage.includes("bundle")) {
      vscode.window.showErrorMessage(
        `haml-lint error: ${errorMessage}. Try running 'bundle install' in your project.`
      );
    } else {
      vscode.window.showErrorMessage(`HAML Hero: Formatting failed: ${errorMessage}`);
    }
    return null;
  }
}