# Repository Guidelines

## Project Structure & Module Organization

This workspace currently contains no application source, tests, assets, or project manifest. The visible directories are `.agents/`, `.codex/`, `.aws/`, and `.git/`; treat these as environment metadata, not application modules. Git commands currently do not recognize this directory as a repository.

When adding the initial implementation, establish a clear layout such as `src/` for application code, `tests/` for automated tests, and `assets/` for static resources. Document the actual layout in this guide as the project takes shape.

## Build, Test, and Development Commands

No build, test, or development commands are configured yet. Do not assume commands such as `npm test` or `make build` are available.

Once a toolchain is selected, commit its manifest and dependency lockfile, and document the exact installation, local development, build, and test commands. Run commands from the project root unless documented otherwise.

## Coding Style & Naming Conventions

No language, formatter, or linter has been established. Follow the conventions of the selected language and configure formatting and linting alongside the first source files. Use consistent indentation, descriptive names, and small modules organized by responsibility. Avoid introducing competing formatting tools.

## Testing Guidelines

No testing framework or coverage threshold exists yet. Add automated tests with new behavior and regression tests with bug fixes. Choose a framework appropriate to the implementation language, adopt its standard test naming pattern, and document how to run the suite. Keep tests deterministic and independent of production credentials.

## Commit & Pull Request Guidelines

Git history is unavailable, so existing commit conventions cannot be verified. Use concise, imperative commit subjects, such as `Add application entry point`, and keep changes focused.

Pull requests should explain the change, its purpose, and validation performed. Link related issues when available and include screenshots for visible interface changes. Explicitly identify any checks that could not be run.

## Security & Configuration

Keep credentials and local configuration out of source control. Provide placeholder values in example configuration files and document required environment variables when introduced. Do not modify environment metadata as part of routine application changes.
