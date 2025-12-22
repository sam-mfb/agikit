/**
 * AGI Command Definitions and Version-Aware Lookup
 *
 * This module provides AGI command definitions and version-aware lookup functions.
 * Commands can vary by AGI interpreter version in two ways:
 *
 * 1. **Command Availability** (`minVersion`): Some commands were added in later
 *    interpreter versions. For example, `hold.key` (opcode 173) was added in v2.917.
 *
 * 2. **Argument Variants** (`variantVersion`, `maxVersion`): Some commands have different
 *    argument counts depending on the interpreter version. For example:
 *    - `quit` takes 0 args in v2.89 and below, 1 arg in v2.90+
 *    - `print.at` takes 2 args in v2.399 and below, 4 args in v2.400+
 *    - `set.simple` takes 0 args in v2.x, 1 arg (String) in v3.x
 *
 * ## Version Fields in AGICommand
 *
 *
 * - `variantVersion`: The AGI version this variant is for (applies to X and above).
 *   Used to distinguish variants, e.g., v3 commands with different argument counts.
 *
 * - `maxVersion`: The max AGI version that supports this variant (applies to X and below).
 *   Used for older variants that were replaced in later versions.
 *
 * - `minVersion`: The min AGI version that supports this command.
 *
 * ## Lookup Priority
 *
 * When multiple variants exist for the same opcode/name, they are tried in order:
 * 1. Variants with `maxVersion` (most specific for old versions)
 * 2. Variants with `variantVersion` (specific for new versions)
 * 3. Variants with no version constraints (fallback)
 *
 * ## Version Thresholds for Command Availability
 *
 * Opcodes 156-161:  Available from v2.90+   (set.menu, menu items, etc.)
 * Opcodes 162-168:  Available from v2.273+  (show.obj.v, mul, div, etc.)
 * Opcodes 169-172:  Available from v2.440+  (close.window, set.simple, push/pop.script)
 * Opcodes 173-174:  Available from v2.917+  (hold.key, set.pri.base)
 * Opcodes 175-176:  Available from v2.936+  (discard.sound, hide.mouse)
 * Opcodes 177-180:  Available from v2.2086+ (allow.menu, show.mouse, fence.mouse, mouse.posn)
 */

import { keyBy } from 'lodash';
import { AGIVersion } from './AGIVersion';
import agiCommandsData from './agiCommands.json';
import testCommandsData from './testCommands.json';

export enum AGICommandArgType {
  Number = 'Number',
  Variable = 'Variable',
  Flag = 'Flag',
  Message = 'Message',
  Object = 'Object',
  Item = 'Item',
  String = 'String',
  Word = 'Word',
  CtrlCode = 'CtrlCode',
}

/**
 * Version specifier for AGI commands.
 * major: 2 for AGI v2.x, 3 for AGI v3.x
 * minor: Optional minor version (e.g., 915 for v2.915)
 */
export type AGICommandVersion = {
  major: number;
  minor?: number;
};

/**
 * AGI command definition with version-aware variants.
 */
export type AGICommand = {
  /** Bytecode opcode (0-181) */
  opcode: number;
  /** Command name (e.g., "print.at", "quit") */
  name: string;
  /** Argument types for this command variant */
  argTypes: AGICommandArgType[];
  /** AGI version this variant is for - applies to X and above */
  variantVersion?: AGICommandVersion;
  /** Max AGI version that supports this variant - applies to X and below */
  maxVersion?: AGICommandVersion;
  /** Min AGI version that supports this command */
  minVersion?: AGICommandVersion;
};

export type TestCommand = {
  opcode: number;
  name: string;
  argTypes: AGICommandArgType[];
  varArgs?: true;
};

export const agiCommands = agiCommandsData as AGICommand[];
export const testCommands = testCommandsData as TestCommand[];

const testCommandsByOpcode = keyBy(testCommands, (cmd) => cmd.opcode);

/**
 * Compare two versions. Returns:
 * - negative if a < b
 * - 0 if a == b
 * - positive if a > b
 * Unversioned (undefined) is treated as the lowest version (fallback)
 */
function compareVersions(
  a: AGICommandVersion | undefined,
  b: AGICommandVersion | undefined,
): number {
  // Unversioned commands come last (lowest priority)
  if (!a && !b) return 0;
  if (!a) return -1; // a is unversioned, comes after b
  if (!b) return 1; // b is unversioned, comes after a

  // Compare major first
  if (a.major !== b.major) {
    return a.major - b.major;
  }

  // Same major, compare minor (undefined minor treated as 0)
  const aMinor = a.minor ?? 0;
  const bMinor = b.minor ?? 0;
  return aMinor - bMinor;
}

/**
 * Check if current version is at least the required version
 */
function isVersionAtLeast(current: AGIVersion, required: AGICommandVersion): boolean {
  if (current.major > required.major) return true;
  if (current.major < required.major) return false;
  // Same major, check minor
  if (required.minor === undefined) return true;
  return current.minor >= required.minor;
}

/**
 * Check if current version is at most the specified version (for "applies to version X and below")
 */
function isVersionAtMost(current: AGIVersion, maxVersion: AGICommandVersion): boolean {
  if (current.major < maxVersion.major) return true;
  if (current.major > maxVersion.major) return false;
  // Same major, check minor
  if (maxVersion.minor === undefined) return true;
  return current.minor <= maxVersion.minor;
}

// Group commands by opcode for version-aware lookup
const agiCommandsByOpcodeGrouped: Map<number, AGICommand[]> = new Map();
for (const cmd of agiCommands) {
  const existing = agiCommandsByOpcodeGrouped.get(cmd.opcode) ?? [];
  existing.push(cmd);
  agiCommandsByOpcodeGrouped.set(cmd.opcode, existing);
}

/**
 * Sort command variants for lookup priority:
 * 1. Commands with maxVersion come first (most specific for old versions)
 * 2. Then commands with version (specific for new versions), highest first
 * 3. Finally commands with no version constraints (fallback)
 */
function sortCommandVariants(a: AGICommand, b: AGICommand): number {
  // Commands with maxVersion come first (they're more specific for old versions)
  if (a.maxVersion && !b.maxVersion) return -1;
  if (!a.maxVersion && b.maxVersion) return 1;
  if (a.maxVersion && b.maxVersion) {
    // Higher maxVersion first (so we try broader ranges first)
    return -compareVersions(a.maxVersion, b.maxVersion);
  }

  // Then commands with variantVersion (specific AGI version)
  if (a.variantVersion && !b.variantVersion) return -1;
  if (!a.variantVersion && b.variantVersion) return 1;
  if (a.variantVersion && b.variantVersion) {
    // Higher version first
    return -compareVersions(a.variantVersion, b.variantVersion);
  }

  // No version constraints - equivalent
  return 0;
}

// Sort each group for proper lookup priority
for (const [, cmds] of agiCommandsByOpcodeGrouped) {
  cmds.sort(sortCommandVariants);
}

// Group commands by name for version-aware lookup
const agiCommandsByNameGrouped: Map<string, AGICommand[]> = new Map();
for (const cmd of agiCommands) {
  const existing = agiCommandsByNameGrouped.get(cmd.name) ?? [];
  existing.push(cmd);
  agiCommandsByNameGrouped.set(cmd.name, existing);
}

// Sort each group for proper lookup priority
for (const [, cmds] of agiCommandsByNameGrouped) {
  cmds.sort(sortCommandVariants);
}

// For name-based lookup, prefer versioned commands (they're more specific)
export const agiCommandsByName: Record<string, AGICommand> = keyBy(
  [...agiCommands].sort((a, b) => (b.variantVersion?.major ?? 0) - (a.variantVersion?.major ?? 0)),
  (cmd) => cmd.name,
);
export const testCommandsByName: Record<string, TestCommand> = keyBy(
  testCommands,
  (cmd) => cmd.name,
);

export function getAGICommand(opcode: number, agiVersion: AGIVersion): AGICommand | undefined {
  // Version-aware lookup: find best matching command for this version
  const candidates = agiCommandsByOpcodeGrouped.get(opcode);
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  // Candidates are pre-sorted by version descending (highest first, unversioned last)
  // Find first command where all version constraints are satisfied
  for (const cmd of candidates) {
    // Check if command exists in this version (minVersion = first available)
    if (cmd.minVersion && !isVersionAtLeast(agiVersion, cmd.minVersion)) {
      continue;
    }

    // Check variant version constraint (variantVersion = applies to X and above)
    if (cmd.variantVersion && !isVersionAtLeast(agiVersion, cmd.variantVersion)) {
      continue;
    }

    // Check maximum version constraint (maxVersion = applies to X and below)
    if (cmd.maxVersion && !isVersionAtMost(agiVersion, cmd.maxVersion)) {
      continue;
    }

    // All constraints satisfied
    return cmd;
  }

  return undefined;
}

export function getTestCommand(opcode: number): TestCommand | undefined {
  return testCommandsByOpcode[opcode];
}

export function getAGICommandByName(name: string, agiVersion: AGIVersion): AGICommand | undefined {
  const candidates = agiCommandsByNameGrouped.get(name);
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  // Candidates are pre-sorted by version descending (highest first, unversioned last)
  // Find first command where all version constraints are satisfied
  for (const cmd of candidates) {
    // Check if command exists in this version (minVersion = first available)
    if (cmd.minVersion && !isVersionAtLeast(agiVersion, cmd.minVersion)) {
      continue;
    }

    // Check variant version constraint (variantVersion = applies to X and above)
    if (cmd.variantVersion && !isVersionAtLeast(agiVersion, cmd.variantVersion)) {
      continue;
    }

    // Check maximum version constraint (maxVersion = applies to X and below)
    if (cmd.maxVersion && !isVersionAtMost(agiVersion, cmd.maxVersion)) {
      continue;
    }

    // All constraints satisfied
    return cmd;
  }

  return undefined;
}
