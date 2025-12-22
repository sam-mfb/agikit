import fs from 'fs';
import path from 'path';
import { Project } from '../Project';
import {
  LogicScriptSyntaxError,
  WordListSyntaxError,
  SyntaxErrorWithFilePath,
  ObjectList,
  Resource,
  ResourceType,
  WordList,
  parseWordList,
  buildWordsTok,
  buildObjectList,
  writeV2ResourceFiles,
  encodeResourceVolumes,
  encodeV2Resource,
  buildPicture,
  readPictureJSON,
  Logger,
  ConsoleLogger,
  writeV3ResourceFiles,
  encodeV3Resource,
  agiLzwCompress,
  LogicResource,
  PicResource,
  Picture,
  readViewResource,
  buildView,
} from '..';
import { compileLogicScript, LogicCompilerError } from './BuildLogic';
import fileSize from 'filesize';

export class ProjectBuilder {
  project: Project;
  logger: Logger;
  private encoding: string;

  constructor(project: Project, logger?: Logger, encoding?: string) {
    this.project = project;
    this.logger = logger ?? new ConsoleLogger();
    this.encoding = encoding ?? 'ascii';
    this.validateEncoding();
  }

  private validateEncoding(): void {
    // Warn if multi-byte encoding is used (AGI only supports single-byte encodings)
    const multiByteEncodings = ['utf8', 'utf-8', 'utf16le', 'utf-16le', 'ucs2', 'ucs-2'];
    if (multiByteEncodings.includes(this.encoding.toLowerCase())) {
      this.logger.warn(
        `Warning: "${this.encoding}" is a multi-byte encoding. AGI only supports single-byte encodings (characters 0-255).`,
      );
      this.logger.warn(
        `  Characters > 127 will use multiple bytes, which AGI interprets separately.`,
      );
      this.logger.warn(
        `  Consider using single-byte encodings like: windows-1252, windows-1251, iso-8859-1, etc.`,
      );
    }
  }

  processFile<T>(processor: (input: string) => T, filePath: string) {
    const input = fs.readFileSync(filePath, 'utf-8');
    try {
      return processor(input);
    } catch (error) {
      if (error instanceof LogicScriptSyntaxError || error instanceof WordListSyntaxError) {
        this.logger.error(error.message);
        this.logger.log(
          `${error instanceof SyntaxErrorWithFilePath ? error.filePath : filePath}:${
            error.location.start.line
          }:${error.location.start.column}`,
        );
        process.exit(1);
      } else if (error instanceof LogicCompilerError) {
        this.logger.error(error.message);
        process.exit(1);
      } else {
        throw error;
      }
    }
  }

  buildResource(
    resourceType: ResourceType,
    resourceNumber: number,
    wordList: WordList,
    objectList: ObjectList,
  ): Resource | undefined {
    if (resourceType === ResourceType.LOGIC) {
      const scriptPath = path.join(this.project.sourcePath, 'logic', `${resourceNumber}.agilogic`);
      if (fs.existsSync(scriptPath)) {
        return this.buildLogic(scriptPath, wordList, objectList, resourceNumber);
      }
    }

    if (resourceType === ResourceType.PIC) {
      const picPath = path.join(this.project.sourcePath, 'pic', `${resourceNumber}.agipic`);
      if (fs.existsSync(picPath)) {
        this.logger.log(`Compiling ${path.relative(this.project.basePath, picPath)}`);

        return this.buildPic(picPath, resourceNumber);
      }
    }

    if (resourceType === ResourceType.VIEW) {
      const viewPath = path.join(this.project.sourcePath, 'view', `${resourceNumber}.agiview`);
      if (fs.existsSync(viewPath)) {
        return this.buildViewResource(viewPath, resourceNumber);
      }
    }

    const dataPath = path.join(
      this.project.sourcePath,
      resourceType.toLowerCase(),
      `${resourceNumber}.agi${resourceType.toLowerCase()}`,
    );
    if (fs.existsSync(dataPath)) {
      this.logger.log(`Reading ${path.relative(this.project.basePath, dataPath)}`);
      const data = fs.readFileSync(dataPath);
      return {
        data,
        number: resourceNumber,
        type: resourceType,
      };
    }

    return undefined;
  }

  private buildPic(picPath: string, resourceNumber: number): PicResource {
    let pictureResource: Picture;
    try {
      const jsonData = JSON.parse(fs.readFileSync(picPath, 'utf-8'));
      pictureResource = readPictureJSON(jsonData);
    } catch (error) {
      this.logger.warn(
        `Compilation failed, treating ${path.relative(
          this.project.basePath,
          picPath,
        )} as raw PIC data`,
      );
      const data = fs.readFileSync(picPath);
      return {
        data,
        number: resourceNumber,
        type: ResourceType.PIC,
      };
    }

    const data = buildPicture(pictureResource, this.project.config.agiVersion.major >= 3);

    return {
      data,
      number: resourceNumber,
      type: ResourceType.PIC,
    };
  }

  private buildViewResource(viewPath: string, resourceNumber: number): Resource {
    this.logger.log(`Reading ${path.relative(this.project.basePath, viewPath)}`);

    // Read the binary view file
    const viewData = fs.readFileSync(viewPath);
    const view = readViewResource(viewData);

    // Check for a description file
    const descPath = path.join(this.project.sourcePath, 'view', `${resourceNumber}.agiviewdesc`);

    if (fs.existsSync(descPath)) {
      this.logger.log(`Merging description from ${path.relative(this.project.basePath, descPath)}`);

      // Read the UTF-8 description and store it
      view.description = fs.readFileSync(descPath, 'utf-8');
    }

    // Rebuild the view with encoding
    const data = buildView(view, this.encoding);

    return {
      data,
      number: resourceNumber,
      type: ResourceType.VIEW,
    };
  }

  private buildLogic(
    scriptPath: string,
    wordList: WordList,
    objectList: ObjectList,
    resourceNumber: number,
  ): LogicResource {
    this.logger.log(`Compiling ${path.relative(this.project.basePath, scriptPath)}`);
    const [data, diagnostics] = this.processFile((input) => {
      if (this.project.config.agiVersion.major >= 3) {
        // AGIv3 stores logic resources either compressed or with encrypted messages, but not both
        // Try compiling unencrypted first and see if compression saves space; if so, use that version
        const [unencryptedData, diagnostics] = compileLogicScript(
          input,
          scriptPath,
          wordList,
          objectList,
          false,
          this.encoding,
          this.project.config.agiVersion,
        );
        const compressedData = agiLzwCompress(unencryptedData);
        if (compressedData.byteLength < unencryptedData.byteLength) {
          return [unencryptedData, diagnostics] as const;
        }
      }

      return compileLogicScript(
        input,
        scriptPath,
        wordList,
        objectList,
        true,
        this.encoding,
        this.project.config.agiVersion,
      );
    }, scriptPath);

    diagnostics.forEach((diagnostic) =>
      this.logger.warn(LogicCompilerError.describeDiagnostic(scriptPath, diagnostic)),
    );

    return {
      data,
      number: resourceNumber,
      type: ResourceType.LOGIC,
    };
  }

  buildProject(): void {
    const destinationPath = this.project.destinationPath;

    fs.mkdirSync(destinationPath, { recursive: true });
    const wordList = this.processFile(parseWordList, this.project.wordListSourcePath);
    const objectList = this.processFile(
      (input) => JSON.parse(input) as ObjectList,
      this.project.objectListSourcePath,
    );

    const resources: Resource[] = [];
    for (const resourceType of [
      ResourceType.PIC,
      ResourceType.VIEW,
      ResourceType.SOUND,
      ResourceType.LOGIC,
    ]) {
      for (let resourceNumber = 0; resourceNumber < 256; resourceNumber++) {
        const resource = this.buildResource(resourceType, resourceNumber, wordList, objectList);
        if (resource) {
          resources.push(resource);
        }
      }
    }

    if (this.project.config.agiVersion.major === 2) {
      writeV2ResourceFiles(
        destinationPath,
        encodeResourceVolumes(resources, encodeV2Resource, this.project.readExplicitVolumeConfig()),
        this.logger,
      );
    } else if (this.project.config.agiVersion.major === 3) {
      writeV3ResourceFiles(
        destinationPath,
        this.project.config.gameId,
        encodeResourceVolumes(resources, encodeV3Resource, this.project.readExplicitVolumeConfig()),
        this.logger,
      );
    } else {
      throw new Error(
        `Unknown AGI version ${JSON.stringify(this.project.config.agiVersion)} in ${
          this.project.projectConfigPath
        }`,
      );
    }

    const wordsTokData = buildWordsTok(wordList);
    this.logger.log(`Writing WORDS.TOK (${fileSize(wordsTokData.byteLength, { base: 2 })})`);
    fs.writeFileSync(path.join(destinationPath, 'WORDS.TOK'), wordsTokData);

    const objectData = buildObjectList(objectList, this.encoding);
    this.logger.log(`Writing OBJECT (${fileSize(objectData.byteLength, { base: 2 })})`);
    fs.writeFileSync(path.join(destinationPath, 'OBJECT'), objectData);
  }
}
