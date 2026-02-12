import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { updateDiagnostics } from "./diagnostics";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Provides code actions (quick fixes) for haml-lint diagnostics.
 */
export class HamlCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "haml-lint" || !diagnostic.code) {
        continue;
      }

      const ruleName = String(diagnostic.code);

      // "Disable rule" - modify workspace .haml-lint.yml
      const disableRuleAction = this.createDisableRuleAction(document, diagnostic, ruleName);
      if (disableRuleAction) {
        actions.push(disableRuleAction);
      }

      // "Disable globally" - add to user settings
      const disableGloballyAction = this.createDisableGloballyAction(document, diagnostic, ruleName);
      if (disableGloballyAction) {
        actions.push(disableGloballyAction);
      }
    }

    return actions;
  }

  private createDisableRuleAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    ruleName: string
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(
      `Disable '${ruleName}' in this project`,
      vscode.CodeActionKind.QuickFix
    );

    action.command = {
      command: "hamlHero.disableRule",
      title: `Disable ${ruleName}`,
      arguments: [document.uri, ruleName],
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = false;

    return action;
  }

  private createDisableGloballyAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    ruleName: string
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(
      `Disable '${ruleName}' globally (all projects)`,
      vscode.CodeActionKind.QuickFix
    );

    action.command = {
      command: "hamlHero.disableLinterGlobally",
      title: `Disable ${ruleName} globally`,
      arguments: [document.uri, ruleName],
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = false;

    return action;
  }
}

/**
 * Disables a linter rule in the workspace .haml-lint.yml
 */
export async function disableRule(
  documentUri: vscode.Uri,
  ruleName: string
): Promise<void> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Cannot determine workspace folder");
    return;
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, ".haml-lint.yml");
  
  try {
    let configContent: string;

    try {
      configContent = await readFile(configPath, "utf8");
    } catch {
      // Config doesn't exist, create new one
      configContent = "";
    }

    const updatedContent = addDisabledLinter(configContent, ruleName);
    await writeFile(configPath, updatedContent, "utf8");

    // Open the config file to show the user what changed
    const configDoc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(configDoc);

    vscode.window.showInformationMessage(
      `Disabled '${ruleName}' in .haml-lint.yml`
    );

    // Refresh diagnostics for all open HAML files
    refreshAllHamlDiagnostics();
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to update .haml-lint.yml: ${error.message}`
    );
  }
}

/**
 * Disables a linter rule globally via VS Code user settings.
 * These rules are excluded via --exclude-linter flag.
 */
export async function disableLinterGlobally(
  documentUri: vscode.Uri,
  ruleName: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration("hamlHero");
  const currentDisabled = config.get<string[]>("globallyDisabledLinters", []);
  
  if (currentDisabled.includes(ruleName)) {
    vscode.window.showInformationMessage(
      `'${ruleName}' is already disabled globally`
    );
    return;
  }

  const updatedDisabled = [...currentDisabled, ruleName];
  
  try {
    // Update at user level (global)
    await config.update("globallyDisabledLinters", updatedDisabled, vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage(
      `Disabled '${ruleName}' globally in VS Code settings`
    );

    // Refresh diagnostics for all open HAML files
    refreshAllHamlDiagnostics();
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to update settings: ${error.message}`
    );
  }
}

/**
 * Refreshes diagnostics for all visible HAML editors.
 */
function refreshAllHamlDiagnostics(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === "haml") {
      updateDiagnostics(editor.document);
    }
  }
}

/**
 * Adds a disabled linter rule to the config content.
 * Handles existing config structure intelligently.
 */
function addDisabledLinter(content: string, ruleName: string): string {
  const lines = content.split("\n");
  
  // Check if rule is already disabled
  const rulePattern = new RegExp(`^\\s*${ruleName}\\s*:`, "m");
  if (rulePattern.test(content)) {
    // Rule section exists, check if already disabled
    const disabledPattern = new RegExp(
      `${ruleName}\\s*:\\s*\\n\\s*enabled\\s*:\\s*false`,
      "m"
    );
    if (disabledPattern.test(content)) {
      // Already disabled
      return content;
    }
    
    // Rule exists but not disabled - we need to add enabled: false
    // This is complex, so we'll append a comment and the override
    return content + `\n# Added by HAML Hero\n  ${ruleName}:\n    enabled: false\n`;
  }

  // Check if linters section exists
  const lintersIndex = lines.findIndex((line) => /^linters\s*:/.test(line));
  
  if (lintersIndex !== -1) {
    // Insert under existing linters section
    const insertIndex = lintersIndex + 1;
    const newEntry = `  ${ruleName}:\n    enabled: false`;
    lines.splice(insertIndex, 0, newEntry);
    return lines.join("\n");
  }
  
  // No linters section, add one
  const newSection = content.length > 0 ? "\n" : "";
  return (
    content +
    newSection +
    `linters:\n  ${ruleName}:\n    enabled: false\n`
  );
}
