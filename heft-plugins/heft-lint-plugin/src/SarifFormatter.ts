// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import url from 'node:url';

import type * as TEslint from 'eslint';

export interface ISerifFormatterOptions {
  ignoreSuppressed: boolean;
  eslintVersion?: string;
}

export interface ISarifRun {
  tool: {
    driver: {
      name: string;
      informationUri: string;
      version?: string;
      rules: IStaticAnalysisRules[];
    };
  };
  artifacts?: ISarifFile[];
  results?: ISarifRepresentation[];
  invocations?: {
    toolConfigurationNotifications: ISarifRepresentation[];
    executionSuccessful: boolean;
  }[];
}

export interface ISarifRepresentation {
  level: string;
  message: {
    text: string;
  };
  locations: ISarifLocation[];
  ruleId?: string;
  descriptor?: {
    id: string;
  };
  suppressions?: ISuppressedAnalysis[];
}

// Interface for the SARIF log structure
export interface ISarifLog {
  version: string;
  $schema: string;
  runs: ISarifRun[];
}

export interface IRegion {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: {
    text: string;
  };
}

export interface IStaticAnalysisRules {
  id: string;
  name?: string;
  shortDescription?: {
    text: string;
  };
  fullDescription?: {
    text: string;
  };
  defaultConfiguration?: {
    level: 'note' | 'warning' | 'error';
  };
  helpUri?: string;
  properties?: {
    category?: string;
    precision?: 'very-high' | 'high' | 'medium' | 'low';
    tags?: string[];
    problem?: {
      severity?: 'recommendation' | 'warning' | 'error';
      securitySeverity?: number;
    };
  };
}

export interface ISarifFile {
  location: {
    uri: string;
  };
}

export interface ISuppressedAnalysis {
  kind: string;
  justification: string;
}

export interface ISarifLocation {
  physicalLocation: ISarifPhysicalLocation;
}

export interface ISarifPhysicalLocation {
  artifactLocation: {
    uri: string;
    index: number;
  };
  region?: IRegion;
}

interface IMessage extends TEslint.Linter.LintMessage {
  suppressions?: ISuppressedAnalysis[];
}

const internalErrorId: 'ESL0999' = 'ESL0999';

/**
 * Converts ESLint results into a SARIF (Static Analysis Results Interchange Format) log.
 *
 * This function takes in a list of ESLint lint results, processes them to extract
 * relevant information such as errors, warnings, and suppressed messages, and
 * outputs a SARIF log which conforms to the SARIF v2.1.0 specification.
 *
 * @param results - An array of lint results (`TEslint.ESLint.LintResult[]`) from ESLint that contains linting information,
 *                  such as file paths, messages, and suppression details.
 * @param options - An object (`ISerifFormatterOptions`) containing options for formatting:
 *                  - `ignoreSuppressed`: Boolean flag to decide whether to ignore suppressed messages.
 *                  - `eslintVersion`: Optional string to include the version of ESLint in the SARIF log.
 * @returns The SARIF log (`ISarifLog`) containing information about the linting results in SARIF format.
 */
export function formatAsSARIF(
  results: TEslint.ESLint.LintResult[],
  options: ISerifFormatterOptions
): ISarifLog {
  const { ignoreSuppressed, eslintVersion } = options;
  const toolConfigurationNotifications: ISarifRepresentation[] = [];
  const sarifFiles: Map<string, ISarifFile> = new Map();
  const sarifResults: ISarifRepresentation[] = [];

  const sarifRun: ISarifRun = {
    tool: {
      driver: {
        name: 'ESLint',
        informationUri: 'https://eslint.org',
        rules: []
      }
    }
  };

  const sarifLog: ISarifLog = {
    version: '2.1.0',
    $schema: 'http://json.schemastore.org/sarif-2.1.0-rtm.5',
    runs: [sarifRun]
  };

  if (typeof eslintVersion !== undefined) {
    sarifRun.tool.driver.version = eslintVersion;
  }
  let executionSuccessful: boolean = true;

  for (const result of results) {
    const { filePath } = result;
    let sarifFile: ISarifFile | undefined = sarifFiles.get(filePath);
    if (sarifFile === undefined) {
      const artifactIndex: number = sarifFiles.size;
      const fileUrl: string = url.pathToFileURL(filePath).toString();

      sarifFile = {
        location: {
          uri: fileUrl
        }
      };
      sarifFiles.set(filePath, sarifFile);

      const containsSuppressedMessages: boolean =
        result.suppressedMessages && result.suppressedMessages.length > 0;
      const messages: IMessage[] =
        containsSuppressedMessages && !ignoreSuppressed
          ? [...result.messages, ...result.suppressedMessages]
          : result.messages;

      if (messages.length > 0) {
        for (const message of messages) {
          const level: string = message.fatal || message.severity === 2 ? 'error' : 'warning';
          const physicalLocation: ISarifPhysicalLocation = {
            artifactLocation: {
              uri: fileUrl,
              index: artifactIndex
            }
          };

          const sarifRepresentation: ISarifRepresentation = {
            level,
            message: {
              text: message.message
            },
            locations: [
              {
                physicalLocation
              }
            ]
          };

          if (message.ruleId) {
            sarifRepresentation.ruleId = message.ruleId;

            if (containsSuppressedMessages && !ignoreSuppressed) {
              sarifRepresentation.suppressions = message.suppressions
                ? message.suppressions.map((suppression: ISuppressedAnalysis) => {
                    return {
                      kind: suppression.kind === 'directive' ? 'inSource' : 'external',
                      justification: suppression.justification
                    };
                  })
                : [];
            }
          } else {
            sarifRepresentation.descriptor = {
              id: internalErrorId
            };

            if (sarifRepresentation.level === 'error') {
              executionSuccessful = false;
            }
          }

          if (message.line || message.column) {
            const { line, column, endLine, endColumn } = message;
            const region: IRegion = {
              startLine: line ? line : undefined,
              startColumn: column ? column : undefined,
              endLine: endLine ? endLine : undefined,
              endColumn: endColumn ? endColumn : undefined
            };
            physicalLocation.region = region;
          }

          if (message.source) {
            physicalLocation.region ??= {};
            physicalLocation.region.snippet = {
              text: message.source
            };
          }

          if (message.ruleId) {
            sarifResults.push(sarifRepresentation);
          } else {
            toolConfigurationNotifications.push(sarifRepresentation);
          }
        }
      }
    }
  }

  if (sarifFiles.size > 0) {
    sarifRun.artifacts = Array.from(sarifFiles.values());
  }

  sarifRun.results = sarifResults;

  if (toolConfigurationNotifications.length > 0) {
    sarifRun.invocations = [
      {
        toolConfigurationNotifications,
        executionSuccessful
      }
    ];
  }

  return sarifLog;
}
