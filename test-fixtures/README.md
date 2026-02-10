# HAML Syntax Highlighting Tests

This directory contains test fixtures for validating the HAML syntax highlighting in the HAML Hero extension.

## Test Files

### basic-syntax.haml
Tests fundamental HAML features:
- Tags with % prefix
- Classes and IDs (., #)
- Attributes (hash, HTML, object reference)
- Ruby script blocks (=, -)
- Comments (-#, /)
- Doctype (!!!)
- Whitespace modifiers (<, >, ~, /)
- Interpolation (#{})

### filters.haml
Tests HAML filters:
- :css filter
- :javascript filter
- :markdown filter
- :ruby filter

### complex-attributes.haml
Tests various attribute syntax combinations:
- Multiple classes and IDs
- Hash attributes with nested structures
- HTML-style attributes
- Object references
- Multiline attributes
- Boolean attributes
- String interpolation in attributes

### ruby-integration.haml
Tests Ruby code integration:
- Control structures (if/elsif/else, case/when, unless)
- Loops (each, while)
- Method calls and chaining
- Blocks and yields
- Lambdas and procs
- Ternary operators
- Safe navigation operator

### rails-helpers.haml
Tests Rails-specific patterns:
- content_for blocks
- Form helpers (form_for, form fields)
- Link helpers (link_to)
- Asset helpers (image_tag, javascript_include_tag, etc.)
- Partial rendering
- Turbo/Stimulus data attributes
- Number and time helpers

### edge-cases.haml
Tests edge cases and special scenarios:
- Empty elements
- Unicode and special characters
- Namespace tags (XML/SVG)
- Very long lines
- Nested structures
- Whitespace preservation
- Conditional attributes
- Multi-line comments

## Manual Testing

To test the syntax highlighting:

1. Open any of the test files in VS Code
2. Verify that:
   - Tags are colored correctly
   - Classes and IDs are distinct
   - Ruby code has proper syntax highlighting
   - Comments are styled appropriately
   - Attributes have proper coloring
   - Interpolation is highlighted
   - Filters have embedded language support

## Expected Highlighting

- **Tags** (entity.name.tag.haml): Tag names like %div, %p, %span
- **Classes** (entity.other.attribute-name.class.haml): .class-name
- **IDs** (entity.other.attribute-name.id.haml): #id-name
- **Comments** (comment.line.haml, comment.block.haml): -# comment, / comment
- **Ruby Output** (punctuation.definition.script.output.haml): = code
- **Ruby Silent** (punctuation.definition.script.silent.haml): - code
- **Interpolation** (meta.interpolation.ruby.haml): #{variable}
- **Doctype** (keyword.other.doctype.haml): !!!
- **Filter** (entity.name.filter.haml): :javascript, :css, etc.

## Automated Testing

The extension uses `vscode-tmgrammar-snap` for snapshot testing:

```bash
# Install dependencies
npm install

# Run tests (compares against saved snapshots)
npm run test:grammar

# Update snapshots (after making intentional grammar changes)
npm run test:grammar:update
```

Snapshot files (`.snap`) capture the token scopes for each test file and are committed to version control. Future test runs compare against these snapshots to detect regressions.
