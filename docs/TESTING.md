# Testing Guide

This guide explains how to test the HAML syntax highlighting in the HAML Hero extension.

## Prerequisites

```bash
npm install
```

This installs:
- TypeScript and compilation tools
- ESLint for code quality
- vscode-tmgrammar-test for grammar testing

## Test Files

The `test-fixtures/` directory contains test files for validating syntax highlighting:

### basic-syntax.haml
Fundamental HAML features:
- Tags with % prefix
- Classes and IDs (., #)
- Attributes (hash, HTML, object reference)
- Ruby script blocks (=, -)
- Comments (-#, /)
- Doctype (!!!)
- Whitespace modifiers (<, >, ~, /)
- Interpolation (#{})

### filters.haml
HAML filters with embedded language support:
- :css filter
- :javascript filter
- :markdown filter
- :ruby filter

### complex-attributes.haml
Attribute syntax combinations:
- Multiple classes and IDs
- Hash attributes with nested structures
- HTML-style attributes
- Object references
- Multiline attributes
- Boolean attributes
- String interpolation in attributes

### ruby-integration.haml
Ruby code integration:
- Control structures (if/elsif/else, case/when, unless)
- Loops (each, while)
- Method calls and chaining
- Blocks and yields
- Lambdas and procs
- Ternary operators
- Safe navigation operator

### rails-helpers.haml
Rails-specific patterns:
- content_for blocks
- Form helpers (form_for, form fields)
- Link helpers (link_to)
- Asset helpers (image_tag, javascript_include_tag, etc.)
- Partial rendering
- Turbo/Stimulus data attributes
- Number and time helpers

### edge-cases.haml
Edge cases and special scenarios:
- Empty elements
- Unicode and special characters
- Namespace tags (XML/SVG)
- Very long lines
- Nested structures
- Whitespace preservation
- Conditional attributes
- Multi-line comments

## Expected Highlighting

When highlighting is working correctly, you should see:

- **Tags** (entity.name.tag.haml): Tag names like %div, %p, %span
- **Classes** (entity.other.attribute-name.class.haml): .class-name
- **IDs** (entity.other.attribute-name.id.haml): #id-name
- **Comments** (comment.line.haml, comment.block.haml): -# comment, / comment
- **Ruby Output** (punctuation.definition.script.output.haml): = code
- **Ruby Silent** (punctuation.definition.script.silent.haml): - code
- **Interpolation** (meta.interpolation.ruby.haml): #{variable}
- **Doctype** (keyword.other.doctype.haml): !!!
- **Filter** (entity.name.filter.haml): :javascript, :css, etc.

## Manual Testing

### Method 1: Extension Development Host

1. Open this project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new VS Code window, open any `.haml` file from `test-fixtures/`
4. Verify syntax highlighting appears correctly according to the "Expected Highlighting" section above

### Method 2: Direct Testing

1. Open any file from `test-fixtures/` in your current VS Code window
2. Verify syntax highlighting (if you have the extension installed)

### Using Scope Inspector

To verify exact scopes assigned to tokens:

1. Place cursor on the token
2. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Run "Developer: Inspect Editor Tokens and Scopes"
4. Verify the scope matches the "Expected Highlighting" section above

## NPM Scripts

```bash
# Run tests (compares against snapshots)
npm run test:grammar

# Update snapshots (after intentional grammar changes)
npm run test:grammar:update

# Compile TypeScript
npm run compile

# Watch TypeScript changes
npm run watch

# Lint TypeScript code
npm run lint
```

## Automated Testing

### Running Tests

```bash
# Run snapshot tests (compares against saved snapshots)
npm run test:grammar

# Update snapshots (when you've made intentional grammar changes)
npm run test:grammar:update
```

The snapshot test:
1. Parses the grammar file
2. Tokenizes all test fixtures
3. Compares token scopes against saved snapshots in `*.snap` files

### Understanding Test Output

**Success:**
```
✓ All tests passed
```

**Failure:**
```
✗ Expected scope 'entity.name.tag.haml' but got 'source.haml'
  at line 5, column 3
```

When tests fail:
1. Review the diff shown in the output (shows expected vs actual scopes)
2. Verify if the change is intentional or a bug
3. Use the scope inspector to debug unexpected changes
4. If changes are intentional, run `npm run test:grammar:update` to update snapshots
5. Otherwise, fix the grammar to match previous behavior and test again

### Adding New Tests

To add new test fixtures:

1. Create a new `.haml` file in `test-fixtures/`
2. Add your HAML code demonstrating the feature
3. Run `npm run test:grammar:update` to generate the snapshot
4. Review the generated `.snap` file in `test-fixtures/` to verify scopes are correct
5. Commit both the test file and its snapshot

**Note:** Snapshot files (`.snap`) should be committed to version control.

## Visual Regression Testing

For major changes, compare before and after:

1. Open all test fixtures
2. Take screenshots of each file
3. Make your changes to the grammar
4. Reload the Extension Development Host (`Cmd+R` or `Ctrl+R`)
5. Compare highlighting to screenshots
6. Verify no unintended changes

## Common Issues

### Grammar Not Loading

- Check JSON syntax: `npm run compile` or use a JSON validator
- Verify `package.json` points to correct grammar file
- Reload Extension Development Host (`Cmd+R` or `Ctrl+R`)

### Patterns Not Matching

- Test regex at [regex101.com](https://regex101.com/)
- Remember to escape special characters: `{` → `\\{`
- Use non-capturing groups `(?:...)` when you don't need captures
- Check for missing or extra backslashes

### Ruby Highlighting Not Working

- Verify `source.ruby` is included in the pattern
- Check that VS Code has Ruby language support installed
- Ensure the pattern's `end` boundary is correct

### Filter Languages Not Highlighting

- Verify VS Code has language support for the embedded language
- Check that the filter name matches exactly (`:javascript`, not `:js`)
- Ensure proper include: `"include": "source.js"`

## Performance Testing

For large files:

1. Create a test file with 1000+ lines of HAML
2. Open in VS Code
3. Verify highlighting appears quickly (< 1 second)
4. Check for lag when typing
5. Profile if needed using VS Code's performance tools

## Reporting Issues

When reporting grammar issues:

1. Include minimal HAML example that reproduces the issue
2. Screenshot showing the incorrect highlighting
3. Expected behavior description
4. VS Code version and extension version
5. Theme being used (some themes may not support all scopes)

## Continuous Testing

When making changes:

1. ✅ Run `npm run compile` - Ensure no TypeScript errors
2. ✅ Run `npm run test:grammar` - Ensure no grammar regressions
3. ✅ Open test fixtures manually - Visual verification
4. ✅ Test in Extension Development Host - Real-world usage
5. ✅ Check edge cases - Unusual syntax combinations

## Resources

- [vscode-tmgrammar-test documentation](https://github.com/PanAeon/vscode-tmgrammar-test)
- [VS Code Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [TextMate Grammar Testing](https://macromates.com/manual/en/language_grammars#testing)
