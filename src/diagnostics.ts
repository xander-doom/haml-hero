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

const diagnosticCollection = vscode.languages.createDiagnosticCollection("haml");

type HamlLintOffense = {
  linter_name: string;
  location: { line: number };
  message: string;
  severity: string;
};

type HamlLintOutput = {
  files: Array<{
    path: string;
    offenses: HamlLintOffense[];
  }>;
};

/**
 * Parse haml-lint JSON output
 */
function parseHamlLintOutput(output: string, document: vscode.TextDocument): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  try {
    const json: HamlLintOutput = JSON.parse(output);
    
    if (json.files.length === 0) {
      return diagnostics;
    }

    for (const offense of json.files[0].offenses) {
      const lineNum = Math.max(offense.location.line - 1, 0);
      
      // Map haml-lint severity to VS Code severity
      let diagSeverity: vscode.DiagnosticSeverity;
      switch (offense.severity) {
        case "error":
        case "fatal":
          diagSeverity = vscode.DiagnosticSeverity.Error;
          break;
        case "warning":
          diagSeverity = vscode.DiagnosticSeverity.Warning;
          break;
        default:
          diagSeverity = vscode.DiagnosticSeverity.Information;
      }

      // Underline from first non-whitespace character to end of line
      const lineText = document.lineAt(lineNum);
      const range = new vscode.Range(
        lineNum,
        lineText.firstNonWhitespaceCharacterIndex,
        lineNum,
        lineText.range.end.character
      );

      const diagnostic = new vscode.Diagnostic(range, offense.message, diagSeverity);
      diagnostic.code = offense.linter_name;
      diagnostic.source = "haml-lint";
      diagnostics.push(diagnostic);
    }
  } catch (error) {
    // If JSON parsing fails, return empty diagnostics
    console.error("Failed to parse haml-lint JSON output:", error);
  }

  return diagnostics;
}

export async function updateDiagnostics(document: vscode.TextDocument): Promise<void> {
  if (document.languageId !== "haml") return;

  const { enableDiagnostics, linterPath, additionalLinterArguments } = getHamlLintConfig();
  if (!enableDiagnostics) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  const { workspaceFolder, cwd } = getWorkspaceInfo(document);
  if (!cwd) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  try {
    const configPath = await getHamlLintConfigPath(workspaceFolder);
    const result = await runHamlLint(document.getText(), document.fileName, {
      autoCorrect: false,
      cwd,
      configPath,
      linterPath,
      additionalArgs: additionalLinterArguments,
    });

    const diagnostics = parseHamlLintOutput(result.output, document);
    diagnosticCollection.set(document.uri, diagnostics);
  } catch (error: any) {
    // Clear diagnostics on error
    diagnosticCollection.delete(document.uri);
    
    // Show user-friendly error message
    const errorMessage = error.message || String(error);
    if (errorMessage.includes("command not found") || 
        errorMessage.includes("ENOENT") ||
        errorMessage.includes("not found") ||
        error.code === "ENOENT") {
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
      vscode.window.showErrorMessage(`haml-lint error: ${errorMessage}`);
    }
  }
}

export function clearDiagnostics(uri: vscode.Uri): void {
  diagnosticCollection.delete(uri);
}

export function clearAllDiagnostics(): void {
  diagnosticCollection.clear();
}

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  return diagnosticCollection;
}
