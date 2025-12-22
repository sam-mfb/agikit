import flatMap from 'lodash/flatMap';
import { getAGICommandByName } from '../Types/AGICommands';
import { AGIVersion } from '../Types/AGIVersion';
import { LogicScriptProgram, LogicScriptStatement } from './LogicScriptParserTypes';

type LogicScriptDiagnosticType = 'UnknownCommandName' | 'WrongNumberOfArguments';

export type LogicDiagnostic = {
  severity: 'warning' | 'error';
  statement: LogicScriptStatement;
  type: LogicScriptDiagnosticType;
  message: string;
};

export function getDiagnosticsForStatement(
  statement: LogicScriptStatement,
  agiVersion: AGIVersion,
): LogicDiagnostic[] {
  const diagnostics: LogicDiagnostic[] = [];

  if (statement.type === 'CommandCall') {
    const command = getAGICommandByName(statement.commandName, agiVersion);
    if (command == null) {
      if (statement.commandName !== 'goto') {
        diagnostics.push({
          severity: 'error',
          statement,
          type: 'UnknownCommandName',
          message: `Unknown command name: "${statement.commandName}"`,
        });
      }
    } else {
      if (statement.argumentList.length !== command.argTypes.length) {
        diagnostics.push({
          severity: 'error',
          statement,
          type: 'WrongNumberOfArguments',
          message: `Wrong number of arguments: expected ${command.argTypes.length}, got ${statement.argumentList.length}`,
        });
      }
    }
  } else if (statement.type === 'IfStatement') {
    diagnostics.push(
      ...getDiagnosticsForProgram(statement.thenStatements, agiVersion),
      ...getDiagnosticsForProgram(statement.elseStatements, agiVersion),
    );
  }

  return diagnostics;
}

export function getDiagnosticsForProgram(
  program: LogicScriptProgram<LogicScriptStatement>,
  agiVersion: AGIVersion,
): LogicDiagnostic[] {
  return flatMap(program, (statement) => getDiagnosticsForStatement(statement, agiVersion));
}
