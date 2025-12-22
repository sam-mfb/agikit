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

export type AGICommandVersion = {
  major: number;
};

export type AGICommand = {
  opcode: number;
  name: string;
  argTypes: AGICommandArgType[];
  version?: AGICommandVersion; // Minimum AGI version required for this command variant
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

// Group commands by opcode for version-aware lookup
const agiCommandsByOpcodeGrouped: Map<number, AGICommand[]> = new Map();
for (const cmd of agiCommands) {
  const existing = agiCommandsByOpcodeGrouped.get(cmd.opcode) ?? [];
  existing.push(cmd);
  agiCommandsByOpcodeGrouped.set(cmd.opcode, existing);
}

// Sort each group by version descending (highest first, unversioned last)
for (const [opcode, cmds] of agiCommandsByOpcodeGrouped) {
  cmds.sort((a, b) => {
    const aVer = a.version?.major ?? 0;
    const bVer = b.version?.major ?? 0;
    return bVer - aVer;
  });
}

// Group commands by name for version-aware lookup
const agiCommandsByNameGrouped: Map<string, AGICommand[]> = new Map();
for (const cmd of agiCommands) {
  const existing = agiCommandsByNameGrouped.get(cmd.name) ?? [];
  existing.push(cmd);
  agiCommandsByNameGrouped.set(cmd.name, existing);
}

// Sort each group by version descending (highest first, unversioned last)
for (const [, cmds] of agiCommandsByNameGrouped) {
  cmds.sort((a, b) => {
    const aVer = a.version?.major ?? 0;
    const bVer = b.version?.major ?? 0;
    return bVer - aVer;
  });
}

// For name-based lookup, prefer versioned commands (they're more specific)
export const agiCommandsByName: Record<string, AGICommand> = keyBy(
  [...agiCommands].sort((a, b) => (b.version?.major ?? 0) - (a.version?.major ?? 0)),
  (cmd) => cmd.name,
);
export const testCommandsByName: Record<string, TestCommand> = keyBy(
  testCommands,
  (cmd) => cmd.name,
);

export function getAGICommand(opcode: number, agiVersion: AGIVersion): AGICommand | undefined {
  // Check if opcode is valid for this version (existing version range checks)
  if (opcode > 177 && (agiVersion.major < 3 || agiVersion.minor <= 2086)) {
    return undefined;
  } else if (opcode > 175 && agiVersion.major === 2 && agiVersion.minor <= 936) {
    return undefined;
  } else if (opcode > 173 && agiVersion.major === 2 && agiVersion.minor <= 917) {
    return undefined;
  } else if (opcode > 169 && agiVersion.major === 2 && agiVersion.minor <= 440) {
    return undefined;
  } else if (opcode > 161 && agiVersion.major === 2 && agiVersion.minor <= 272) {
    return undefined;
  } else if (opcode > 155 && agiVersion.major === 2 && agiVersion.minor <= 89) {
    return undefined;
  }

  // Version-specific argument count overrides (legacy, will be migrated to data-driven)
  if (opcode === 134 && agiVersion.major === 2 && agiVersion.minor <= 89) {
    const baseCmd = agiCommandsByOpcodeGrouped.get(opcode)?.[0];
    return baseCmd ? { ...baseCmd, argTypes: [] } : undefined; // quit
  }

  if ((opcode === 151 || opcode === 152) && agiVersion.major === 2 && agiVersion.minor < 400) {
    // print.at and print.at.v
    const baseCmd = agiCommandsByOpcodeGrouped.get(opcode)?.[0];
    return baseCmd ? { ...baseCmd, argTypes: baseCmd.argTypes.slice(0, 2) } : undefined;
  }

  // Version-aware lookup: find best matching command for this version
  const candidates = agiCommandsByOpcodeGrouped.get(opcode);
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  // Candidates are pre-sorted by version descending
  // Find first command where version requirement is met
  for (const cmd of candidates) {
    if (!cmd.version || agiVersion.major >= cmd.version.major) {
      return cmd;
    }
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

  // Candidates are pre-sorted by version descending
  // Find first command where version requirement is met
  for (const cmd of candidates) {
    if (!cmd.version || agiVersion.major >= cmd.version.major) {
      return cmd;
    }
  }

  return undefined;
}
