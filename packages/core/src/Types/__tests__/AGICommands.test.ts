import { describe, it, expect } from 'vitest';
import { getAGICommand, getAGICommandByName, agiCommands, AGICommandArgType } from '../AGICommands';
import { AGIVersion } from '../AGIVersion';

describe('AGICommands', () => {
  describe('version-aware command definitions', () => {
    it('should have both v2 and v3 variants for allow.menu (opcode 177)', () => {
      const variants = agiCommands.filter((cmd) => cmd.opcode === 177);
      expect(variants.length).toBe(2);

      const v2Variant = variants.find((cmd) => !cmd.variantVersion);
      const v3Variant = variants.find((cmd) => cmd.variantVersion?.major === 3);

      expect(v2Variant).toBeDefined();
      expect(v2Variant?.argTypes).toEqual([]);

      expect(v3Variant).toBeDefined();
      expect(v3Variant?.argTypes).toEqual([AGICommandArgType.Number]);
    });

    it('should have v3 variants for all mouse/menu commands', () => {
      const v3Opcodes = [170, 174, 175, 176, 177, 178, 179, 180];

      for (const opcode of v3Opcodes) {
        const variants = agiCommands.filter((cmd) => cmd.opcode === opcode);
        const v3Variant = variants.find((cmd) => cmd.variantVersion?.major === 3);
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
    // AGI v2.937 - supports opcodes up to 176
    const agiV2New: AGIVersion = { major: 2, minor: 937 };
    // AGI v2.2086+ - newer v2 version, supports opcodes 177-180
    const agiV2Newest: AGIVersion = { major: 2, minor: 2086 };
    // AGI v3 - supports all opcodes with v3 argument counts
    const agiV3: AGIVersion = { major: 3, minor: 2149 };

    describe('allow.menu (opcode 177)', () => {
      it('should return undefined for old AGI v2 (not available)', () => {
        const cmd = getAGICommand(177, agiV2Old);
        expect(cmd).toBeUndefined();
      });

      it('should return undefined for v2.937 (requires v2.2086+)', () => {
        const cmd = getAGICommand(177, agiV2New);
        expect(cmd).toBeUndefined();
      });

      it('should return 0 args for AGI v2.2086+', () => {
        const cmd = getAGICommand(177, agiV2Newest);
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

    describe('minVersion semantics', () => {
      it('should return undefined for commands before their minVersion', () => {
        // set.menu (opcode 156) requires v2.90+
        const v2_89: AGIVersion = { major: 2, minor: 89 };
        const cmd = getAGICommand(156, v2_89);
        expect(cmd).toBeUndefined();
      });

      it('should return command at exactly minVersion', () => {
        const v2_90: AGIVersion = { major: 2, minor: 90 };
        const cmd = getAGICommand(156, v2_90);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('set.menu');
      });

      it('should return command after minVersion', () => {
        const v2_100: AGIVersion = { major: 2, minor: 100 };
        const cmd = getAGICommand(156, v2_100);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('set.menu');
      });

      it('should respect different minVersion thresholds', () => {
        // show.obj.v (162) requires v2.273+
        const v2_272: AGIVersion = { major: 2, minor: 272 };
        const v2_273: AGIVersion = { major: 2, minor: 273 };

        expect(getAGICommand(162, v2_272)).toBeUndefined();
        expect(getAGICommand(162, v2_273)).toBeDefined();

        // close.window (169) requires v2.440+
        const v2_439: AGIVersion = { major: 2, minor: 439 };
        const v2_440: AGIVersion = { major: 2, minor: 440 };

        expect(getAGICommand(169, v2_439)).toBeUndefined();
        expect(getAGICommand(169, v2_440)).toBeDefined();

        // hold.key (173) requires v2.917+
        const v2_916: AGIVersion = { major: 2, minor: 916 };
        const v2_917: AGIVersion = { major: 2, minor: 917 };

        expect(getAGICommand(173, v2_916)).toBeUndefined();
        expect(getAGICommand(173, v2_917)).toBeDefined();
      });
    });

    describe('maxVersion semantics', () => {
      it('should use maxVersion variant at exactly maxVersion', () => {
        // quit with 0 args has maxVersion v2.89
        const v2_89: AGIVersion = { major: 2, minor: 89 };
        const cmd = getAGICommand(134, v2_89);
        expect(cmd).toBeDefined();
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should not use maxVersion variant above maxVersion', () => {
        // quit with 1 arg for v2.90+
        const v2_90: AGIVersion = { major: 2, minor: 90 };
        const cmd = getAGICommand(134, v2_90);
        expect(cmd).toBeDefined();
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });

      it('should use maxVersion variant below maxVersion', () => {
        // print.at with 2 args has maxVersion v2.399
        const v2_300: AGIVersion = { major: 2, minor: 300 };
        const cmd = getAGICommand(151, v2_300);
        expect(cmd).toBeDefined();
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Message, AGICommandArgType.Number]);
      });
    });

    describe('version (minimum) semantics for v3 variants', () => {
      it('should use v3 variant only for v3+', () => {
        const v2_999: AGIVersion = { major: 2, minor: 999 };
        const v3_100: AGIVersion = { major: 3, minor: 100 };

        // set.simple (170) has v2 variant with 0 args, v3 variant with 1 arg
        const v2Cmd = getAGICommand(170, v2_999);
        const v3Cmd = getAGICommand(170, v3_100);

        expect(v2Cmd?.argTypes).toEqual([]);
        expect(v3Cmd?.argTypes).toEqual([AGICommandArgType.String]);
      });

      it('should use v3 variant for higher major versions', () => {
        // fence.mouse (179) has v3 variant with 4 args
        const v3_0: AGIVersion = { major: 3, minor: 0 };
        const cmd = getAGICommand(179, v3_0);
        expect(cmd).toBeDefined();
        expect(cmd?.argTypes).toHaveLength(4);
      });
    });

    describe('quit (opcode 134)', () => {
      it('should return 0 args for AGI v2.89 and below', () => {
        const v2_89: AGIVersion = { major: 2, minor: 89 };
        const cmd = getAGICommand(134, v2_89);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('quit');
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg for AGI v2.90 and above', () => {
        const v2_90: AGIVersion = { major: 2, minor: 90 };
        const cmd = getAGICommand(134, v2_90);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('quit');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });

      it('should return 1 arg for AGI v2.915', () => {
        const cmd = getAGICommand(134, agiV2Old);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('quit');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });
    });

    describe('print.at (opcode 151)', () => {
      it('should return 2 args for AGI v2.399 and below', () => {
        const v2_399: AGIVersion = { major: 2, minor: 399 };
        const cmd = getAGICommand(151, v2_399);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Message, AGICommandArgType.Number]);
      });

      it('should return 4 args for AGI v2.400 and above', () => {
        const v2_400: AGIVersion = { major: 2, minor: 400 };
        const cmd = getAGICommand(151, v2_400);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at');
        expect(cmd?.argTypes).toEqual([
          AGICommandArgType.Message,
          AGICommandArgType.Number,
          AGICommandArgType.Number,
          AGICommandArgType.Number,
        ]);
      });

      it('should return 4 args for AGI v2.915', () => {
        const cmd = getAGICommand(151, agiV2Old);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at');
        expect(cmd?.argTypes).toHaveLength(4);
      });
    });

    describe('print.at.v (opcode 152)', () => {
      it('should return 2 args for AGI v2.399 and below', () => {
        const v2_399: AGIVersion = { major: 2, minor: 399 };
        const cmd = getAGICommand(152, v2_399);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at.v');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Message, AGICommandArgType.Variable]);
      });

      it('should return 4 args for AGI v2.400 and above', () => {
        const v2_400: AGIVersion = { major: 2, minor: 400 };
        const cmd = getAGICommand(152, v2_400);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at.v');
        expect(cmd?.argTypes).toEqual([
          AGICommandArgType.Message,
          AGICommandArgType.Variable,
          AGICommandArgType.Variable,
          AGICommandArgType.Variable,
        ]);
      });
    });
  });

  describe('getAGICommandByName', () => {
    // AGI v2.915 - older v2 version
    const agiV2Old: AGIVersion = { major: 2, minor: 915 };
    // AGI v2.937 - supports opcodes up to 176
    const agiV2New: AGIVersion = { major: 2, minor: 937 };
    // AGI v2.2086+ - newer v2 version, supports opcodes 177-180
    const agiV2Newest: AGIVersion = { major: 2, minor: 2086 };
    // AGI v3 - supports all opcodes with v3 argument counts
    const agiV3: AGIVersion = { major: 3, minor: 2149 };

    describe('allow.menu', () => {
      it('should return undefined for v2.937 (requires v2.2086+)', () => {
        const cmd = getAGICommandByName('allow.menu', agiV2New);
        expect(cmd).toBeUndefined();
      });

      it('should return 0 args for AGI v2.2086+', () => {
        const cmd = getAGICommandByName('allow.menu', agiV2Newest);
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

    describe('quit', () => {
      it('should return 0 args for AGI v2.89 and below', () => {
        const v2_89: AGIVersion = { major: 2, minor: 89 };
        const cmd = getAGICommandByName('quit', v2_89);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('quit');
        expect(cmd?.argTypes).toEqual([]);
      });

      it('should return 1 arg for AGI v2.90 and above', () => {
        const v2_90: AGIVersion = { major: 2, minor: 90 };
        const cmd = getAGICommandByName('quit', v2_90);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('quit');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Number]);
      });
    });

    describe('print.at', () => {
      it('should return 2 args for AGI v2.399 and below', () => {
        const v2_399: AGIVersion = { major: 2, minor: 399 };
        const cmd = getAGICommandByName('print.at', v2_399);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Message, AGICommandArgType.Number]);
      });

      it('should return 4 args for AGI v2.400 and above', () => {
        const v2_400: AGIVersion = { major: 2, minor: 400 };
        const cmd = getAGICommandByName('print.at', v2_400);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at');
        expect(cmd?.argTypes).toHaveLength(4);
      });
    });

    describe('print.at.v', () => {
      it('should return 2 args for AGI v2.399 and below', () => {
        const v2_399: AGIVersion = { major: 2, minor: 399 };
        const cmd = getAGICommandByName('print.at.v', v2_399);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at.v');
        expect(cmd?.argTypes).toEqual([AGICommandArgType.Message, AGICommandArgType.Variable]);
      });

      it('should return 4 args for AGI v2.400 and above', () => {
        const v2_400: AGIVersion = { major: 2, minor: 400 };
        const cmd = getAGICommandByName('print.at.v', v2_400);
        expect(cmd).toBeDefined();
        expect(cmd?.name).toBe('print.at.v');
        expect(cmd?.argTypes).toHaveLength(4);
      });
    });
  });
});
