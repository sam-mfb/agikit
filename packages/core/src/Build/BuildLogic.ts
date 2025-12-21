import { LogicInstruction } from '../Types/Logic';
import { optimizeAST } from '../Extract/Logic/ASTOptimization';
import { LogicAssembler } from '../Scripting/LogicAssembler';
import { LogicCompiler } from '../Scripting/LogicCompiler';
import { LogicScriptASTGenerator } from '../Scripting/LogicScriptASTGenerator';
import { parseLogicScript, parseLogicScriptRaw } from '../Scripting/LogicScriptParser';
import { encodeLogic, encodeMessages } from '../Scripting/WriteLogic';
import { WordList } from '../Types/WordList';
import { ObjectList } from '../Types/ObjectList';
import { getDiagnosticsForProgram, LogicDiagnostic } from '../Scripting/LogicDiagnostics';
import { AGIVersion } from '../Types/AGIVersion';

export class LogicCompilerError extends Error {
  scriptPath: string;
  diagnostics: LogicDiagnostic[];

  static describeDiagnostic(scriptPath: string, diagnostic: LogicDiagnostic): string {
    const location = diagnostic.statement.location?.start;
    const locationSuffix = location ? `:${location.line}:${location.column}` : '';
    return `${scriptPath}${locationSuffix}: ${diagnostic.message}`;
  }

  constructor(scriptPath: string, diagnostics: LogicDiagnostic[]) {
    super(
      diagnostics
        .map((diagnostic) => LogicCompilerError.describeDiagnostic(scriptPath, diagnostic))
        .join('\n'),
    );
    this.scriptPath = scriptPath;
    this.diagnostics = diagnostics;
  }
}

export function assembleLogic(
  instructions: LogicInstruction[],
  messages: (string | undefined)[],
  encryptMessages: boolean,
  encoding: string = 'ascii',
): Buffer {
  const assembler = new LogicAssembler(instructions);
  const logic = encodeLogic(
    assembler.assemble(),
    encodeMessages(messages, encryptMessages, encoding),
  );
  return logic;
}

export function compileLogicScript(
  sourceCode: string,
  scriptPath: string,
  wordList: WordList,
  objectList: ObjectList,
  encryptMessages: boolean,
  encoding: string,
  agiVersion: AGIVersion,
): [Buffer, LogicDiagnostic[]] {
  const rawProgram = parseLogicScriptRaw(sourceCode, scriptPath);
  const diagnostics = getDiagnosticsForProgram(rawProgram, agiVersion);
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    throw new LogicCompilerError(scriptPath, diagnostics);
  }

  const parseTree = parseLogicScript(rawProgram, scriptPath);
  const astGenerator = new LogicScriptASTGenerator(parseTree, wordList, objectList, agiVersion);
  const root = astGenerator.generateASTForLogicScript();
  const graph = optimizeAST(root);
  const compiler = new LogicCompiler(graph, astGenerator.getLabels());
  const { instructions } = compiler.compile();
  const messages = astGenerator.generateMessageArray();
  const logic = assembleLogic(instructions, messages, encryptMessages, encoding);
  return [logic, diagnostics];
}
