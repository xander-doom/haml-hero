import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { updateDiagnostics } from "./diagnostics";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Import to trigger config regeneration
let regenerateConfigCallback: (() => Promise<void>) | null = null;

export function setRegenerateConfigCallback(callback: () => Promise<void>): void {
  regenerateConfigCallback = callback;
}

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
      const isRubocopRule = ruleName === "RuboCop";

      if (isRubocopRule) {
        // Extract actual RuboCop rule name from message
        // Message format: "Style/StringLiterals: Description text..."
        const match = diagnostic.message.match(/^([^:]+):/);
        if (match) {
          const rubocopRuleName = match[1].trim();
          
          // RuboCop-specific actions
          const disableRubocopProjectAction = this.createDisableRubocopRuleAction(
            document,
            diagnostic,
            rubocopRuleName
          );
          if (disableRubocopProjectAction) {
            actions.push(disableRubocopProjectAction);
          }

          const disableRubocopGloballyAction = this.createDisableRubocopRuleGloballyAction(
            document,
            diagnostic,
            rubocopRuleName
          );
          if (disableRubocopGloballyAction) {
            actions.push(disableRubocopGloballyAction);
          }
        }
      } else {
        // Standard haml-lint actions
        const disableRuleAction = this.createDisableRuleAction(document, diagnostic, ruleName);
        if (disableRuleAction) {
          actions.push(disableRuleAction);
        }

        const disableGloballyAction = this.createDisableGloballyAction(document, diagnostic, ruleName);
        if (disableGloballyAction) {
          actions.push(disableGloballyAction);
        }
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
      command: "_hamlHero.disableRule",
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
      command: "_hamlHero.disableLinterGlobally",
      title: `Disable ${ruleName} globally`,
      arguments: [document.uri, ruleName],
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = false;

    return action;
  }

  private createDisableRubocopRuleAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    ruleName: string
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(
      `Disable RuboCop '${ruleName}' in this project (.rubocop.yml)`,
      vscode.CodeActionKind.QuickFix
    );

    action.command = {
      command: "_hamlHero.disableRubocopRule",
      title: `Disable RuboCop ${ruleName}`,
      arguments: [document.uri, ruleName],
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = true; // Preferred for RuboCop rules

    return action;
  }

  private createDisableRubocopRuleGloballyAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    ruleName: string
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(
      `Disable RuboCop '${ruleName}' globally (VS Code settings)`,
      vscode.CodeActionKind.QuickFix
    );

    action.command = {
      command: "_hamlHero.disableRubocopRuleGlobally",
      title: `Disable RuboCop ${ruleName} globally`,
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

/**
 * Disables a RuboCop rule in the workspace .rubocop.yml
 * This is the standard way to configure RuboCop and works for both .rb and .haml files.
 */
export async function disableRubocopRule(
  documentUri: vscode.Uri,
  ruleName: string
): Promise<void> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Cannot determine workspace folder");
    return;
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, ".rubocop.yml");
  
  try {
    let configContent: string;

    try {
      configContent = await readFile(configPath, "utf8");
    } catch {
      // Config doesn't exist, create new one
      configContent = "";
    }

    const updatedContent = addDisabledRubocopRule(configContent, ruleName);
    await writeFile(configPath, updatedContent, "utf8");

    // Open the config file to show the user what changed
    const configDoc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(configDoc);

    vscode.window.showInformationMessage(
      `Disabled RuboCop '${ruleName}' in .rubocop.yml`
    );

    // Refresh diagnostics for all open HAML files
    refreshAllHamlDiagnostics();
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to update .rubocop.yml: ${error.message}`
    );
  }
}

/**
 * Disables a RuboCop rule globally via VS Code user settings.
 */
export async function disableRubocopRuleGlobally(
  documentUri: vscode.Uri,
  ruleName: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration("hamlHero");
  const currentDisabled = config.get<string[]>("disabledRubocopRules", []);
  
  if (currentDisabled.includes(ruleName)) {
    vscode.window.showInformationMessage(
      `RuboCop '${ruleName}' is already disabled globally`
    );
    return;
  }

  const updatedDisabled = [...currentDisabled, ruleName];
  
  try {
    // Update at user level (global)
    await config.update("disabledRubocopRules", updatedDisabled, vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage(
      `Disabled RuboCop '${ruleName}' globally in VS Code settings`
    );

    // Trigger config regeneration
    if (regenerateConfigCallback) {
      await regenerateConfigCallback();
    }

    // Refresh diagnostics for all open HAML files
    refreshAllHamlDiagnostics();
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to update settings: ${error.message}`
    );
  }
}

/**
 * Adds a disabled RuboCop rule to the .rubocop.yml content.
 */
function addDisabledRubocopRule(content: string, ruleName: string): string {
  const lines = content.split("\n");
  
  // Check if rule is already disabled
  const rulePattern = new RegExp(`^${ruleName}\\s*:`, "m");
  if (rulePattern.test(content)) {
    // Rule section exists, check if already disabled
    const disabledPattern = new RegExp(
      `${ruleName}\\s*:\\s*\\n\\s*Enabled\\s*:\\s*false`,
      "m"
    );
    if (disabledPattern.test(content)) {
      // Already disabled
      return content;
    }
    
    // Rule exists but not disabled - append override
    const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    return content + separator + `\n${ruleName}:\n  Enabled: false\n`;
  }

  // Add new rule at the end
  // Only add leading newline if file has existing content
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  const leadingNewline = content.trim().length > 0 ? "\n" : "";
  return (
    content +
    separator +
    leadingNewline +
    `${ruleName}:\n  Enabled: false\n`
  );
}
