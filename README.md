# HAML Hero

Comprehensive HAML support for Visual Studio Code with advanced syntax highlighting, linting, and auto-formatting capabilities.

## Features

- **🎨 Enhanced Syntax Highlighting**: Comprehensive syntax highlighting for all HAML features, including multi-line ruby and hash attributes
- **✨ Auto-Formatting**: Format HAML files on save (powered by [`haml-lint`](https://github.com/sds/haml-lint))
- **🔍 Real-time Diagnostics**: Live linting feedback with warnings and errors as you type (powered by [`haml-lint`](https://github.com/sds/haml-lint))
- **⚙️ Highly Configurable**: Customize linter path, formatter mode, and additional arguments

## Requirements

For auto-formatting functionality, you need to install [haml-lint](https://github.com/sds/haml-lint):

### Project-Level Installation (Recommended)

Add to your `Gemfile`:

```ruby
group :development do
  gem 'haml_lint', require: false
end
```

Then run:

```bash
bundle install
```

### Global Installation


```bash
gem install haml_lint
```
Warning: A global installation will be pinned to a specific version of Ruby that may not match your project

## VS Code Settings

Auto-formatting is enabled under default vscode settings, but if you have another linter installed (like Prettier) you may need to add these settings to your [settings.json file](https://code.visualstudio.com/docs/configure/settings#_user-settings:~:text=Select%20the%20Preferences%3A%20Open%20User%20Settings%20%28JSON%29%20command%20in%20the%20Command%20Palette) to enable HAML formatting.

```json
{
  "[haml]": {
    "editor.defaultFormatter": "XanderDoom.haml-hero",
    "editor.formatOnSave": true,
    "editor.formatOnPaste": true
  }
}
```

## Extension Settings

This extension has the following settings:

### Core Settings

- `hamlHero.enableFormatting`: Enable automatic formatting with haml-lint (default: `true`)
- `hamlHero.enableDiagnostics`: Enable real-time linting diagnostics (default: `true`)

### Linter Configuration

- `hamlHero.linterPath`: Full path to the haml-lint executable (default: `"haml-lint"`)
  - For global installation: leave as `"haml-lint"`
  - For Bundler: use `"bundle exec haml-lint"` or full path to bundle
- `hamlHero.configPath`: Path to a custom .haml-lint.yml config file
  - If not specified, checks workspace root for `.haml-lint.yml`, then uses extension's default config (which disables LineLength linting because I don't agree with their default of 80 characters)
  - Supports `~` for home directory and relative paths from workspace root
  - Example: `"~/.haml-lint.yml"` or `"config/.haml-lint.yml"`
- `hamlHero.additionalLinterArguments`: Additional arguments to pass to haml-lint when running diagnostics (default: `""`)

### Formatter Settings

- `hamlHero.formatterMode`: Determines which auto-corrections to apply (default: `"safe"`)
  - `"safe"`: Only apply safe auto-corrections (`--auto-correct`)
  - `"all"`: Apply all auto-corrections, including potentially unsafe ones (`--auto-correct-all`)
- `hamlHero.additionalFormatterArguments`: Additional arguments to pass to haml-lint when formatting (default: `""`)

### Example Configuration

```json
{
  "hamlHero.linterPath": "bundle exec haml-lint",
  "hamlHero.formatterMode": "all",
  "hamlHero.configPath": "config/.haml-lint.yml",
  "hamlHero.additionalFormatterArguments": "--parallel"
}
```

### Configuring haml-lint Rules

**Option 1: Use workspace config** (recommended for team projects)  
Create `.haml-lint.yml` in your project root. This will automatically be used.

**Option 2: Use custom config location**  
Set `hamlHero.configPath` to point to your config file.

**Option 3: Rely on extension defaults**  
The extension's bundled config will be used if no workspace config exists.

## Known Issues

Linter warnings and errors highlight the entire line instead of just the offending code. This is [an issue with `haml-lint`](https://github.com/sds/haml-lint/issues/274), and won't be fixed;

Filter blocks (:ruby, :markdown) may not terminate correctly if there is trailing whitespace on the line they should end on.

Please report additional issues on the [GitHub repository](https://github.com/yourusername/haml-hero).

## Development

### Testing Syntax Highlighting

Test fixtures are available in the `test-fixtures/` directory. Open any of these files to verify syntax highlighting:

- `basic-syntax.haml` - Core HAML features
- `filters.haml` - Embedded language filters
- `complex-attributes.haml` - Various attribute syntaxes
- `ruby-integration.haml` - Ruby code integration
- `rails-helpers.haml` - Rails-specific patterns
- `edge-cases.haml` - Special scenarios

Run automated grammar tests:
```bash
npm install
npm run test:grammar          # Run tests
npm run test:grammar:update   # Update snapshots after grammar changes
```

See [test-fixtures/README.md](test-fixtures/README.md) and [docs/TESTING.md](docs/TESTING.md) for more details.

**Enjoy!**
