import * as vscode from "vscode";
import * as path from "path";

/**
 * Parses .haml-lint.yml to extract linter settings for autocorrection.
 */
interface LinterSettings {
  finalNewlinePresent: boolean;
  spaceInsideHashAttributesStyle: "space" | "no_space";
}

/**
 * Reads .haml-lint.yml and extracts linter settings for FinalNewline and SpaceInsideHashAttributes.
 */
async function getLinterSettings(
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<LinterSettings> {
  const defaults: LinterSettings = {
    finalNewlinePresent: true,
    spaceInsideHashAttributesStyle: "space",
  };

  if (!workspaceFolder) {
    return defaults;
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, ".haml-lint.yml");
  try {
    const configUri = vscode.Uri.file(configPath);
    const configBytes = await vscode.workspace.fs.readFile(configUri);
    const configContent = Buffer.from(configBytes).toString("utf8");

    // Parse FinalNewline present setting
    const finalNewlineMatch = configContent.match(
      /FinalNewline:\s*\n(?:[ \t]+[^\n]+\n)*?[ \t]+present:\s*(true|false)/
    );
    if (finalNewlineMatch) {
      defaults.finalNewlinePresent = finalNewlineMatch[1] === "true";
    }

    // Parse SpaceInsideHashAttributes style setting
    const spaceStyleMatch = configContent.match(
      /SpaceInsideHashAttributes:\s*\n(?:[ \t]+[^\n]+\n)*?[ \t]+style:\s*['"]?(space|no_space)['"]?/
    );
    if (spaceStyleMatch) {
      defaults.spaceInsideHashAttributesStyle = spaceStyleMatch[1] as "space" | "no_space";
    }
  } catch {
    // Config doesn't exist or can't be read - use defaults
  }

  return defaults;
}

/**
 * Removes trailing whitespace from all lines.
 */
function autocorrectTrailingWhitespace(content: string): string {
  return content.replace(/[ \t]+$/gm, "");
}

/**
 * Ensures file ends with exactly one newline (or none if present is false).
 */
function autocorrectFinalNewline(content: string, present: boolean): string {
  // Remove all trailing newlines first
  const trimmed = content.replace(/\n+$/, "");
  
  // Add exactly one newline if present is true
  return present ? trimmed + "\n" : trimmed;
}

/**
 * Fixes spacing inside hash attributes based on style.
 * 
 * For 'space' style: { key: value }
 * For 'no_space' style: {key: value}
 * 
 * Handles multiline where closing brace on its own line is always valid.
 */
function autocorrectSpaceInsideHashAttributes(
  content: string,
  style: "space" | "no_space"
): string {
  const lines = content.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Only process lines that look like HAML elements with hash attributes
    // Match element lines: %tag, .class, #id followed by {
    if (/^[ \t]*[%#.][\w-]*.*\{/.test(line)) {
      line = fixHashAttributesOnLine(line, style);
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Fixes hash attribute spacing on a single line.
 */
function fixHashAttributesOnLine(line: string, style: "space" | "no_space"): string {
  // Find hash attributes - look for { that's part of element attributes
  // Need to handle nested braces in Ruby code carefully
  
  let result = "";
  let i = 0;
  
  while (i < line.length) {
    // Find the start of hash attributes
    if (line[i] === "{") {
      const hashStart = i;
      let braceDepth = 1;
      let j = i + 1;
      
      // Find matching closing brace
      while (j < line.length && braceDepth > 0) {
        if (line[j] === "{") {
          braceDepth++;
        } else if (line[j] === "}") {
          braceDepth--;
        }
        j++;
      }
      
      if (braceDepth === 0) {
        // Found complete hash attributes from hashStart to j-1 (inclusive of braces)
        const hashContent = line.substring(hashStart + 1, j - 1);
        const fixedHash = fixHashContent(hashContent, style);
        result += "{" + fixedHash + "}";
        i = j;
      } else {
        // Unclosed brace - multiline hash, just fix the opening
        const afterBrace = line.substring(hashStart + 1);
        const fixedOpening = fixHashOpening(afterBrace, style);
        result += "{" + fixedOpening;
        i = line.length;
      }
    } else {
      result += line[i];
      i++;
    }
  }
  
  return result;
}

/**
 * Fixes the content between hash braces (single line complete hash).
 */
function fixHashContent(content: string, style: "space" | "no_space"): string {
  const trimmed = content.trim();
  
  if (trimmed === "") {
    // Empty hash: {} for both styles
    return "";
  }
  
  if (style === "space") {
    return " " + trimmed + " ";
  } else {
    return trimmed;
  }
}

/**
 * Fixes the opening of a multiline hash (content after opening brace to end of line).
 */
function fixHashOpening(afterBrace: string, style: "space" | "no_space"): string {
  // For multiline, if there's content after the brace on the same line, fix spacing
  // If line ends right after brace (empty or whitespace), leave as-is (content on next line)
  
  const trimmedLeft = afterBrace.replace(/^[ \t]+/, "");
  
  if (trimmedLeft === "" || trimmedLeft === "\n") {
    // Nothing after opening brace - leave as is
    return afterBrace;
  }
  
  if (style === "space") {
    return " " + trimmedLeft;
  } else {
    return trimmedLeft;
  }
}

/**
 * Applies all autocorrection rules to content.
 * 
 * Corrections applied:
 * - TrailingWhitespace: Remove trailing spaces/tabs from lines
 * - SpaceInsideHashAttributes: Fix spacing in hash attributes based on config
 * - FinalNewline: Ensure proper number of trailing newlines
 */
export async function applyAutocorrections(
  content: string,
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<string> {
  const settings = await getLinterSettings(workspaceFolder);
  
  let result = content;
  
  let t = performance.now();
  result = autocorrectTrailingWhitespace(result);
  console.log(`  - TrailingWhitespace: ${(performance.now() - t).toFixed(2)}ms`);
  
  t = performance.now();
  result = autocorrectSpaceInsideHashAttributes(result, settings.spaceInsideHashAttributesStyle);
  console.log(`  - SpaceInsideHashAttributes: ${(performance.now() - t).toFixed(2)}ms`);
  
  t = performance.now();
  result = autocorrectFinalNewline(result, settings.finalNewlinePresent);
  console.log(`  - FinalNewline: ${(performance.now() - t).toFixed(2)}ms`);
  
  return result;
}
