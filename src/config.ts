import * as vscode from "vscode";
import * as path from "path";

/**
 * Gets the haml-lint config file path to use.
 * Priority:
 * 1. User-specified config path from settings
 * 2. .haml-lint.yml in workspace root
 * 3. Default config bundled with extension
 */
export async function getConfigPath(
  context: vscode.ExtensionContext,
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<string> {
  const config = vscode.workspace.getConfiguration("hamlHero");

  // 1. Check for user-specified config path
  const userConfigPath = config.get<string>("configPath");
  if (userConfigPath) {
    const expandedPath = userConfigPath.replace(/^~/, process.env.HOME || "");
    const absolutePath = path.isAbsolute(expandedPath)
      ? expandedPath
      : path.join(workspaceFolder?.uri.fsPath || "", expandedPath);

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
      return absolutePath;
    } catch {
      vscode.window.showWarningMessage(
        `HAML Hero: Config not found at "${userConfigPath}", using default`
      );
    }
  }

  // 2. Check for .haml-lint.yml in workspace root
  if (workspaceFolder) {
    const workspaceConfigPath = path.join(workspaceFolder.uri.fsPath, ".haml-lint.yml");
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(workspaceConfigPath));
      return workspaceConfigPath;
    } catch {
      // Fall through to default
    }
  }

  // 3. Use default config bundled with extension
  return path.join(context.extensionPath, ".haml-lint.yml");
}
