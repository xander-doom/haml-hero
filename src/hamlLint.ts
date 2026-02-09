import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getConfigPath } from "./config";

const execAsync = promisify(exec);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

let extensionContext: vscode.ExtensionContext;

export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export interface HamlLintResult {
  success: boolean;
  output: string;
  formattedContent?: string;
  exitCode?: number;
}

interface HamlLintOptions {
  autoCorrect?: boolean;
  cwd: string;
  configPath: string;
  linterPath: string;
  additionalArgs?: string;
}

/**
 * Creates a temp file with the given content and returns the path.
 */
async function createTempFile(content: string, originalFileName: string): Promise<string> {
  const tempFile = path.join(
    os.tmpdir(),
    `haml-lint-${Date.now()}-${path.basename(originalFileName)}`
  );
  await writeFile(tempFile, content, "utf8");
  return tempFile;
}

/**
 * Safely deletes a temp file, ignoring errors.
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Runs haml-lint on the given content.
 */
export async function runHamlLint(
  content: string,
  originalFilePath: string,
  options: HamlLintOptions
): Promise<HamlLintResult> {
  const tempFile = await createTempFile(content, originalFilePath);

  try {
    let command: string;
    
    if (options.autoCorrect) {
      const config = vscode.workspace.getConfiguration("hamlHero");
      const formatterMode = config.get<string>("formatterMode", "safe");
      const autoCorrectFlag = formatterMode === "all" ? "--auto-correct-all" : "--auto-correct";
      const additionalArgs = options.additionalArgs || "";
      
      command = `"${options.linterPath}" ${autoCorrectFlag} --auto-correct-only --reporter json --config "${options.configPath}" ${additionalArgs} "${tempFile}"`.trim();
    } else {
      const additionalArgs = options.additionalArgs || "";
      command = `"${options.linterPath}" --reporter json --config "${options.configPath}" ${additionalArgs} "${tempFile}"`.trim();
    }

    try {
      const result = await execAsync(command, { cwd: options.cwd });
      
      if (options.autoCorrect) {
        const formattedContent = await readFile(tempFile, "utf8");
        await cleanupTempFile(tempFile);
        return { success: true, output: result.stdout || "", formattedContent };
      }
      
      await cleanupTempFile(tempFile);
      return { success: true, output: result.stdout || "" };
    } catch (error: any) {
      // haml-lint exits non-zero when it finds issues
      if (options.autoCorrect) {
        const formattedContent = await readFile(tempFile, "utf8");
        await cleanupTempFile(tempFile);
        return { 
          success: true, 
          output: error.stdout || "", 
          formattedContent,
          exitCode: error.code 
        };
      }
      
      await cleanupTempFile(tempFile);
      
      if (error.stdout) {
        return { success: true, output: error.stdout, exitCode: error.code };
      }
      
      throw error;
    }
  } catch (error: any) {
    await cleanupTempFile(tempFile);
    throw error;
  }
}

/**
 * Gets the workspace folder and cwd for a document.
 */
export function getWorkspaceInfo(document: vscode.TextDocument): { 
  workspaceFolder?: vscode.WorkspaceFolder; 
  cwd?: string 
} {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = workspaceFolder?.uri.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return { workspaceFolder, cwd };
}

/**
 * Gets the haml-lint configuration from VS Code settings.
 */
export function getHamlLintConfig() {
  const config = vscode.workspace.getConfiguration("hamlHero");
  return {
    linterPath: config.get<string>("linterPath", "haml-lint"),
    enableDiagnostics: config.get<boolean>("enableDiagnostics", true),
    enableFormatting: config.get<boolean>("enableFormatting", true),
    formatterMode: config.get<string>("formatterMode", "safe"),
    additionalLinterArguments: config.get<string>("additionalLinterArguments", ""),
    additionalFormatterArguments: config.get<string>("additionalFormatterArguments", ""),
  };
}

/**
 * Gets the config file path for haml-lint.
 */
export async function getHamlLintConfigPath(
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<string> {
  return getConfigPath(extensionContext, workspaceFolder);
}
