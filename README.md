# agikit-slim

agikit-slim is a fork of the original agikit toolchain here:

https://github.com/nbudin/agikit

The purpose of the fork is to focus solely on decompiling and compiling and not any user interface issues. This makes it easier to keep dependencies up to date and to add new features.

The features that have been added to it beyond the original agikit are:

- Compiling with encoded text (for non ascii languages)
- Decompiling individual views (and recompiling with encoded descriptions)
- Decompiling individual pics (and recompiling)
- Support for AGIv3 opcodes
- Improved handling of gotos and orphan labels

## Background

The original agikit was made as a developer toolchain for Sierra's AGI (Adventure Game Interpreter) engine. AGI was used
in the 1980s to develop adventure games including King's Quest I, II, and III, Space Quest I and II,
and more. Later, it was reverse engineered by fans and used to develop many fan-made games.
A lot more information about AGI is available at
[the AGI Programmers Wiki](http://agiwiki.sierrahelp.com).

## Command line usage

To install the CLI globally:

`npm install -g @agikit-slim/cli`

### Extract an AGI game to source files

`agikit extract path/to/game output/path`

This will extract all resources including:

- Logic scripts (to `.agilogic` files)
- Pictures (to `.agipic` JSON files)
- Views (to `.agiview` binary files, with `.agiviewdesc` text files for descriptions)
- Sounds (to `.agisound` files)
- Objects and vocabulary

### Build AGI game volume files from source

`agikit build path/to/project [--encoding <encoding>]`

Builds the game from source files. The `--encoding` parameter allows you to specify the character encoding for text (default: `ascii`).

**Encoding examples:**

- `agikit build myproject --encoding windows-1255` (Hebrew)
- `agikit build myproject --encoding windows-1251` (Russian/Cyrillic)
- `agikit build myproject --encoding windows-1252` (Western European)

The encoding affects:

- Object names in `object.json`
- View descriptions in `.agiviewdesc` files
- Any text in logic scripts

### Decompile a single view file

`agikit decompile-view path/to/view.agv [outputdir]`

Extracts a single view resource to:

- `<name>.agiview` - Binary pixel data
- `<name>.agiviewdesc` - UTF-8 text description (if the view has one)

If `outputdir` is not specified, files are created in the same directory as the input file.

### Compile a single view file

`agikit compile-view path/to/view.agiview [outputfile] [--encoding <encoding>]`

Builds a view resource from:

- `<name>.agiview` - Binary pixel data (required)
- `<name>.agiviewdesc` - UTF-8 text description (optional, if exists in same directory)

The `--encoding` parameter specifies how to encode the description text (default: `ascii`).

If `outputfile` is not specified, creates `<name>.agv` in the same directory as the input file.

### Decompile a single pic file

`agikit decompile-pic path/to/pic.agp [outputfile] [--compress-colors]`

Extracts a single picture resource to a `.agipic` JSON file.

### Compile a single pic file

`agikit compile-pic path/to/pic.agipic [outputfile] [--compress-colors]`

Builds a picture resource from a `.agipic` JSON file.

The `--compress-colors` option is for certain AGI versions that use compressed color format.

## Development Setup

This project uses [Rush.js](https://rushjs.io/) with pnpm for monorepo management.

### Prerequisites

- Node.js >= 20.0.0
- Rush installed globally: `npm install -g @microsoft/rush`

### Getting Started

```bash
# Install dependencies
rush update

# Build all packages
rush rebuild

# Build only changed packages
rush build

# Format code
rush format

# Check code formatting
rush format:check
```

### Project Structure

- `packages/core` - Core AGI compiler/decompiler library
- `packages/cli` - Command-line interface
- `packages/examples` - Example AGI applications in English and Hebrew that can be used for testing

### Publishing

This project uses Rush's change file workflow for version management.

**Developer workflow (before creating PR):**

After making changes to a package, create a change file:

```bash
rush change
```

This will prompt you to:

- Select which packages changed
- Choose the version bump type (major/minor/patch)
- Describe your changes

Commit the generated change file (in `common/changes/`) with your PR.

**Maintainer workflow (publishing a release):**

1. Merge PRs to main (each should include change files)
2. Create a new GitHub release with a tag (e.g., `v1.0.1`)
3. GitHub Actions will automatically:
   - Process all change files
   - Bump package versions accordingly
   - Generate/update CHANGELOGs
   - Build all packages
   - Publish to npm with public access

The packages will be published to:

- https://www.npmjs.com/package/@agikit-slim/core
- https://www.npmjs.com/package/@agikit-slim/cli

## Current status

Todo Priorities:

- Add additional command line options

Known limitations:

- Not compatible with WinAGI projects
- There are some missing features in the LOGIC language:
  - `]` as a comment character
