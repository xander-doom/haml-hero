import * as vscode from "vscode";
import {
  setExtensionContext as setHamlLintContext,
  runHamlLint,
  getWorkspaceInfo,
  getHamlLintConfig,
  getHamlLintConfigPath,
} from "./hamlLint";
import { applyAutocorrections } from "./autocorrect";

// Track documents currently being formatted to prevent infinite save loops
const formattingInProgress = new Set<string>();

export function setExtensionContext(context: vscode.ExtensionContext): void {
  setHamlLintContext(context);
}

/**
 * Document formatter - handles both synchronous and background formatting.
 * When formatInBackground is enabled, kicks off async formatting and returns null.
 */
export async function formatHamlDocument(
  document: vscode.TextDocument
): Promise<vscode.TextEdit[] | null> {
  const { enableFormatting, formatInBackground } = getHamlLintConfig();
  if (!enableFormatting) {
    return null;
  }
  
  // When background formatting is enabled, kick off async formatting and return null
  if (formatInBackground) {
    // Don't await - let it run in background
    formatDocumentInBackground(document);
    return null;
  }

  const { cwd } = getWorkspaceInfo(document);
  if (!cwd) {
    vscode.window.showErrorMessage(
      "HAML Hero: Cannot determine workspace folder"
    );
    return null;
  }

  const { linterPath, additionalFormatterArguments, enableAutocorrections } = getHamlLintConfig();
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

    // Start with haml-lint formatted content or original
    let formattedContent = result.formattedContent || document.getText();
    
    // Apply our custom autocorrections if enabled
    if (enableAutocorrections) {
      formattedContent = await applyAutocorrections(
        formattedContent,
        vscode.workspace.getWorkspaceFolder(document.uri)
      );
    }

    if (formattedContent !== document.getText()) {
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      return [vscode.TextEdit.replace(fullRange, formattedContent)];
    }

    return null;
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    // Check specifically for haml-lint executable not found (not temp file errors)
    const isHamlLintNotFound = 
      (errorMessage.includes("command not found") && errorMessage.includes("haml-lint")) ||
      (errorMessage.includes("spawn") && errorMessage.includes("ENOENT")) ||
      error.code === 127;
    if (isHamlLintNotFound) {
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

/**
 * Checks if a document is currently being formatted.
 */
export function isFormattingInProgress(uri: vscode.Uri): boolean {
  return formattingInProgress.has(uri.toString());
}

/**
 * Formats a document in the background and applies changes directly to the editor.
 * Saves the document after formatting completes.
 */
export async function formatDocumentInBackground(
  document: vscode.TextDocument
): Promise<void> {
  const { enableFormatting, formatInBackground } = getHamlLintConfig();
  if (!enableFormatting || !formatInBackground) {
    return;
  }

  const uriString = document.uri.toString();
  
  // Prevent concurrent formatting of the same document
  if (formattingInProgress.has(uriString)) {
    return;
  }

  const { cwd } = getWorkspaceInfo(document);
  if (!cwd) {
    return;
  }

  // Mark as formatting immediately to prevent concurrent operations
  formattingInProgress.add(uriString);

  try {
    const { linterPath, additionalFormatterArguments, enableAutocorrections } = getHamlLintConfig();
    const configPath = await getHamlLintConfigPath(
      vscode.workspace.getWorkspaceFolder(document.uri)
    );

    const originalContent = document.getText();
    const originalVersion = document.version;
    
    const result = await runHamlLint(originalContent, document.fileName, {
      autoCorrect: true,
      cwd,
      configPath,
      linterPath,
      additionalArgs: additionalFormatterArguments,
    });

    // Skip if document was modified while formatting was running
    if (document.version !== originalVersion) {
      return;
    }

    // Start with haml-lint formatted content or original
    let formattedContent = result.formattedContent || originalContent;
    
    // Apply our custom autocorrections if enabled
    if (enableAutocorrections) {
      formattedContent = await applyAutocorrections(
        formattedContent,
        vscode.workspace.getWorkspaceFolder(document.uri)
      );
    }

    if (formattedContent !== originalContent) {
      // Use WorkspaceEdit to apply changes - works even if document isn't visible
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(document.uri, fullRange, formattedContent);
      
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      if (success) {
        // Save the document with the formatted content
        await document.save();
      }
    }
  } catch (error: any) {
    // Background formatting errors are logged but don't show intrusive messages
    // since the file was already saved successfully
    const errorMessage = error.message || String(error);
    // Check specifically for haml-lint executable not found (not temp file errors)
    const isHamlLintNotFound = 
      (errorMessage.includes("command not found") && errorMessage.includes("haml-lint")) ||
      (errorMessage.includes("spawn") && errorMessage.includes("ENOENT")) ||
      error.code === 127;
    if (isHamlLintNotFound) {
      vscode.window.showErrorMessage(
        `haml-lint not found. Please install it with 'gem install haml_lint' or configure the path in settings (hamlHero.linterPath).`
      );
    }
    // Other errors (including temp file issues) are silently ignored for background formatting
  } finally {
    // Always remove from formatting set
    formattingInProgress.delete(uriString);
  }
}