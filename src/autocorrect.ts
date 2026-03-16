import * as vscode from "vscode";
import * as path from "path";

/**
 * Parses .haml-lint.yml to extract linter settings for autocorrection.
 */
interface LinterSettings {
  trailingWhitespaceEnabled: boolean;
  spaceBeforeScriptEnabled: boolean;
  spaceInsideHashAttributesEnabled: boolean;
  spaceInsideHashAttributesStyle: "space" | "no_space";
  finalNewlineEnabled: boolean;
  finalNewlinePresent: boolean;
  rubyCommentsEnabled: boolean;
}

/**
 * Checks if a linter is enabled in the config content.
 * Linters are enabled by default unless explicitly set to enabled: false.
 */
function isLinterEnabled(configContent: string, linterName: string): boolean {
  const pattern = new RegExp(
    `${linterName}:\\s*\\n(?:[ \\t]+[^\\n]+\\n)*?[ \\t]+enabled:\\s*(true|false)`
  );
  const match = configContent.match(pattern);
  return match ? match[1] === "true" : true; // default to enabled
}

/**
 * Reads .haml-lint.yml and extracts linter settings.
 */
async function getLinterSettings(
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<LinterSettings> {
  const defaults: LinterSettings = {
    trailingWhitespaceEnabled: true,
    spaceBeforeScriptEnabled: true,
    spaceInsideHashAttributesEnabled: true,
    spaceInsideHashAttributesStyle: "space",
    finalNewlineEnabled: true,
    finalNewlinePresent: true,
    rubyCommentsEnabled: true,
  };

  if (!workspaceFolder) {
    return defaults;
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, ".haml-lint.yml");
  try {
    const configUri = vscode.Uri.file(configPath);
    const configBytes = await vscode.workspace.fs.readFile(configUri);
    const configContent = Buffer.from(configBytes).toString("utf8");

    // Parse enabled state for each linter
    defaults.trailingWhitespaceEnabled = isLinterEnabled(configContent, "TrailingWhitespace");
    defaults.spaceBeforeScriptEnabled = isLinterEnabled(configContent, "SpaceBeforeScript");
    defaults.spaceInsideHashAttributesEnabled = isLinterEnabled(configContent, "SpaceInsideHashAttributes");
    defaults.finalNewlineEnabled = isLinterEnabled(configContent, "FinalNewline");
    defaults.rubyCommentsEnabled = isLinterEnabled(configContent, "RubyComments");

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
    // Skip if preceded by # (Ruby interpolation like #{...})
    if (line[i] === "{" && (i === 0 || line[i - 1] !== "#")) {
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
 * Handles spacing for script operators and Ruby comments.
 * 
 * SpaceBeforeScript rule:
 *   HAML script operators (=, !=, &=, ~, -) should be followed by exactly one space.
 * 
 * RubyComments rule:
 *   Use `-#` for comments instead of `- #` (no space before #).
 */
function autocorrectSpaceBeforeScript(
  content: string,
  spaceBeforeScriptEnabled: boolean,
  rubyCommentsEnabled: boolean
): string {
  const lines = content.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check if this is a Ruby comment line (- followed by optional space and #)
    const commentMatch = line.match(/^(\s*)-(\s*)#(.*)$/);
    if (commentMatch) {
      // This is a comment line - apply RubyComments rule
      if (rubyCommentsEnabled) {
        // Ensure NO space between - and # (rule: use -# not - #)
        const leadingWhitespace = commentMatch[1];
        const commentContent = commentMatch[3];
        line = leadingWhitespace + "-#" + commentContent;
      }
      // If rubyCommentsEnabled is false, leave unchanged
    } else if (spaceBeforeScriptEnabled) {
      // Not a comment line - apply SpaceBeforeScript rule
      // Match lines starting with script operators: =, !=, &=, ~, -
      // [!&]?=(?!=) matches =, !=, &= but not ==
      const match = line.match(/^(\s*)([!&]?=(?!=)|~|-)(\s*)(.*)$/);
      
      if (match) {
        const leadingWhitespace = match[1];
        const operator = match[2];
        const spacesAfter = match[3];
        const code = match[4];
        
        // If there's actual code after the operator, ensure exactly one space
        // Otherwise preserve the line (handles blank lines with just operators)
        if (code.trim().length > 0) {
          line = leadingWhitespace + operator + " " + code;
        } else if (code.length === 0 && spacesAfter.length > 0) {
          // Line ends with operator + whitespace but no code - remove trailing space
          line = leadingWhitespace + operator;
        }
        // else: line is just whitespace + operator, leave as-is
      }
    }
    
    result.push(line);
  }

  return result.join("\n");
}

/**
 * Applies all autocorrection rules to content.
 * 
 * Corrections applied:
 * - TrailingWhitespace: Remove trailing spaces/tabs from lines
 * - SpaceBeforeScript: Ensure one space between script operators and code
 * - SpaceInsideHashAttributes: Fix spacing in hash attributes based on config
 * - FinalNewline: Ensure proper number of trailing newlines
 */
export async function applyAutocorrections(
  content: string,
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<string> {
  const settings = await getLinterSettings(workspaceFolder);
  
  let result = content;
  
  if (settings.trailingWhitespaceEnabled) {
    result = autocorrectTrailingWhitespace(result);
  }
  if (settings.spaceBeforeScriptEnabled || settings.rubyCommentsEnabled) {
    result = autocorrectSpaceBeforeScript(
      result,
      settings.spaceBeforeScriptEnabled,
      settings.rubyCommentsEnabled
    );
  }
  if (settings.spaceInsideHashAttributesEnabled) {
    result = autocorrectSpaceInsideHashAttributes(result, settings.spaceInsideHashAttributesStyle);
  }
  if (settings.finalNewlineEnabled) {
    result = autocorrectFinalNewline(result, settings.finalNewlinePresent);
  }
  
  return result;
}
