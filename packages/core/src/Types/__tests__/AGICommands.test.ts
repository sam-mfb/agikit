import { describe, it, expect } from 'vitest';
import { getAGICommand, getAGICommandByName, agiCommands, AGICommandArgType } from '../AGICommands';
import { AGIVersion } from '../AGIVersion';

describe('AGICommands', () => {
  describe('version-aware command definitions', () => {
    it('should have both v2 and v3 variants for allow.menu (opcode 177)', () => {
      const variants = agiCommands.filter((cmd) => cmd.opcode === 177);
      expect(variants.length).toBe(2);

      const v2Variant = variants.find((cmd) => !cmd.version);
      const v3Variant = variants.find((cmd) => cmd.version?.major === 3);

      expect(v2Variant).toBeDefined();
      expect(v2Variant?.argTypes).toEqual([]);

      expect(v3Variant).toBeDefined();
      expect(v3Variant?.argTypes).toEqual([AGICommandArgType.Number]);
    });

    it('should have v3 variants for all mouse/menu commands', () => {
      const v3Opcodes = [170, 174, 175, 176, 177, 178, 179, 180];

      for (const opcode of v3Opcodes) {
        const variants = agiCommands.filter((cmd) => cmd.opcode === opcode);
        const v3Variant = variants.find((cmd) => cmd.version?.major === 3);
        expect(v3Variant, `opcode ${opcode} should have v3 variant`).toBeDefined();
        expect(
          v3Variant?.argTypes.length,
          `opcode ${opcode} v3 variant should have args`,
        ).toBeGreaterThan(0);
      }
    });
  });

  describe('getAGICommand', () => {
    // AGI v2.915 - older v2 version, doesn't support opcodes 176+
    const agiV2Old: AGIVersion = { major: 2, minor: 915 };
    // AGI v2.937+ - newer v2 version, supports opcodes 176-177
    const agiV2New: AGIVersion = { major: 2, minor: 937 };
    // AGI v3 - supports all opcodes with v3 argument counts
    const agiV3: AGIVersion = { major: 3, minor: 2149 };

    describe('allow.menu (opcode 177)', () => {
      it('should return undefined for old AGI v2 (not available)', () => {
        const cmd = getAGICommand(177, agiV2Old);
        expect(cmd).toBeUndefined();
      });

      it('should return 0 args for new AGI v2', () => {
        // v2.936+ supports opcode 177, but with 0 args
        const cmd = getAGICommand(177, agiV2New);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('allow.menu');
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg for AGI v3', () => {
        const cmd = getAGICommand(177, agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('allow.menu');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });
    });

    describe('hide.mouse (opcode 176)', () => {
      it('should return undefined for old AGI v2 (not available)', () => {
        const cmd = getAGICommand(176, agiV2Old);
        expect(cmd).toBeUndefined();
      });

      it('should return 0 args for new AGI v2', () => {
        const cmd = getAGICommand(176, agiV2New);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('hide.mouse');
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg for AGI v3', () => {
        const cmd = getAGICommand(176, agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('hide.mouse');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });
    });

    describe('fence.mouse (opcode 179)', () => {
      it('should return undefined for AGI v2 (not available)', () => {
        // Opcode 179 requires v3 or specific v2 versions
        const cmd = getAGICommand(179, agiV2New);
        expect(cmd).toBeUndefined();
      });

      it('should return 4 args for AGI v3', () => {
        const cmd = getAGICommand(179, agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('fence.mouse');
        expect(cmd?.argTypes).toHaveLength(4);
        expect(cmd?.argTypes).toEqual([
          AGICommandArgType.Number,
          AGICommandArgType.Number,
          AGICommandArgType.Number,
          AGICommandArgType.Number,
        ]);
      });
    });

    describe('mouse.posn (opcode 180)', () => {
      it('should return undefined for AGI v2 (not available)', () => {
        const cmd = getAGICommand(180, agiV2New);
        expect(cmd).toBeUndefined();
      });

      it('should return 2 args for AGI v3', () => {
        const cmd = getAGICommand(180, agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('mouse.posn');
        expect(cmd?.argTypes).toHaveLength(2);
      });
    });

    describe('set.simple (opcode 170)', () => {
      it('should return 0 args for AGI v2', () => {
        const cmd = getAGICommand(170, agiV2Old);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('set.simple');
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg (String) for AGI v3', () => {
        const cmd = getAGICommand(170, agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('set.simple');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.String]);
      });
    });

    describe('commands without version variants', () => {
      it('should return same command for both v2 and v3', () => {
        // new.room (opcode 18) has no version-specific variants
        const cmdV2 = getAGICommand(18, agiV2Old);
        const cmdV3 = getAGICommand(18, agiV3);

        expect(cmdV2).toBeDefined();
        expect(cmdV3).toBeDefined();
        expect(cmdV2?.name).toBe('new.room');
        expect(cmdV3?.name).toBe('new.room');
        expect(cmdV2?.argTypes).toEqual(cmdV3?.argTypes);
      });

      it('should return increment with 1 arg for both versions', () => {
        const cmdV2 = getAGICommand(1, agiV2Old);
        const cmdV3 = getAGICommand(1, agiV3);

        expect(cmdV2?.name).toBe('increment');
        expect(cmdV3?.name).toBe('increment');
        expect(cmdV2?.argTypes).toEqual([AGICommandArgType.Variable]);
        expect(cmdV3?.argTypes).toEqual([AGICommandArgType.Variable]);
      });
    });

    describe('version range checks', () => {
      it('should return undefined for opcodes not available in version', () => {
        // Opcode 178+ requires AGI v3 or specific v2 minor versions
        const oldV2: AGIVersion = { major: 2, minor: 900 };
        const cmd = getAGICommand(178, oldV2);
        expect(cmd).toBeUndefined();
      });

      it('should return command for opcodes available in version', () => {
        const cmd = getAGICommand(178, agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('show.mouse');
      });
    });
  });

  describe('getAGICommandByName', () => {
    // AGI v2.915 - older v2 version
    const agiV2Old: AGIVersion = { major: 2, minor: 915 };
    // AGI v2.937+ - newer v2 version
    const agiV2New: AGIVersion = { major: 2, minor: 937 };
    // AGI v3 - supports all opcodes with v3 argument counts
    const agiV3: AGIVersion = { major: 3, minor: 2149 };

    describe('allow.menu', () => {
      it('should return 0 args for AGI v2', () => {
        const cmd = getAGICommandByName('allow.menu', agiV2New);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('allow.menu');
        expect(cmd?.argTypes).toEqual([]);
        expect(cmd?.opcode).toBe(177);
      });

      it('should return 1 arg for AGI v3', () => {
        const cmd = getAGICommandByName('allow.menu', agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('allow.menu');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
        expect(cmd?.opcode).toBe(177);
      });
    });

    describe('set.simple', () => {
      it('should return 0 args for AGI v2', () => {
        const cmd = getAGICommandByName('set.simple', agiV2Old);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('set.simple');
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg (String) for AGI v3', () => {
        const cmd = getAGICommandByName('set.simple', agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('set.simple');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.String]);
      });
    });

    describe('hide.mouse', () => {
      it('should return 0 args for AGI v2', () => {
        const cmd = getAGICommandByName('hide.mouse', agiV2New);
        expect(cmd).toBeDefined();
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg for AGI v3', () => {
        const cmd = getAGICommandByName('hide.mouse', agiV3);
        expect(cmd).toBeDefined();
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });
    });

    describe('commands without version variants', () => {
      it('should return same command for both v2 and v3', () => {
        const cmdV2 = getAGICommandByName('new.room', agiV2Old);
        const cmdV3 = getAGICommandByName('new.room', agiV3);

        expect(cmdV2).toBeDefined();
        expect(cmdV3).toBeDefined();
        expect(cmdV2?.name).toBe('new.room');
        expect(cmdV3?.name).toBe('new.room');
        expect(cmdV2?.argTypes).toEqual(cmdV3?.argTypes);
        expect(cmdV2?.opcode).toBe(cmdV3?.opcode);
      });

      it('should return return command for both versions', () => {
        const cmdV2 = getAGICommandByName('return', agiV2Old);
        const cmdV3 = getAGICommandByName('return', agiV3);

        expect(cmdV2?.name).toBe('return');
        expect(cmdV3?.name).toBe('return');
        expect(cmdV2?.argTypes).toEqual([]);
        expect(cmdV3?.argTypes).toEqual([]);
      });
    });

    describe('unknown commands', () => {
      it('should return undefined for unknown command name', () => {
        const cmd = getAGICommandByName('nonexistent.command', agiV2Old);
        expect(cmd).toBeUndefined();
      });
    });
  });
});
