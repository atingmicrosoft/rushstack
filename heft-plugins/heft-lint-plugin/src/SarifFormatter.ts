// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.
import type * as TEslint from 'eslint';
import * as crypto from 'crypto';
import path from 'node:path';
import { Path } from '@rushstack/node-core-library';

export interface ISerifFormatterOptions {
  ignoreSuppressed: boolean;
  eslintVersion?: string;
  buildFolderPath: string;
}

export interface ISarifRun {
  tool: {
    driver: {
      name: string;
      fullName: string;
      informationUri: string;
      version?: string;
      rules: IStaticAnalysisRules[];
    };
  };
  automationDetails: IAutomationDetails;
  artifacts?: ISarifFile[];
  results?: ISarifRepresentation[];
  invocations?: {
    toolConfigurationNotifications: ISarifRepresentation[];
    executionSuccessful: boolean;
  }[];
}

export interface IAutomationDetails {
  id: string;
  description?: {
    text: string;
  };
}

export interface ISarifRepresentation {
  level: string;
  message: {
    text: string;
  };
  locations: ISarifLocation[];
  ruleId?: string;
  ruleIndex?: number;
  descriptor?: {
    id: string;
  };
  suppressions?: ISuppressedAnalysis[];
  partialFingerprints: IPartialFingerprint;
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

export interface ISarifArtifactLocation {
  uri: string;
  index?: number;
}

export interface ISarifPhysicalLocation {
  artifactLocation: ISarifArtifactLocation;
  region?: IRegion;
}

export interface ISarifRule {
  id: string;
  name: string;
  helpUri?: string;
  shortDescription?: {
    text: string;
  };
  properties?: {
    category?: string;
  };
}

export interface IPartialFingerprint {
  buildFolderPathHash: string;
  ruleIdHash?: string;
  messageIdHash: string;
}

interface IMessage extends TEslint.Linter.LintMessage {
  suppressions?: ISuppressedAnalysis[];
}

const INTERNAL_ERROR_ID: 'ESL0999' = 'ESL0999';
const SARIF_VERSION: '2.1.0' = '2.1.0';
const SARIF_INFORMATION_URI: 'https://json.schemastore.org/sarif-2.1.0.json' =
  'https://json.schemastore.org/sarif-2.1.0.json';
/**
 * Converts ESLint results into a SARIF (Static Analysis Results Interchange Format) log.
 *
 * This function takes in a list of ESLint lint results, processes them to extract
 * relevant information such as errors, warnings, and suppressed messages, and
 * outputs a SARIF log which conforms to the SARIF v2.1.0 specification.
 *
 * @param results - An array of lint results from ESLint that contains linting information,
 *                  such as file paths, messages, and suppression details.
 * @param rulesMeta - An object containing metadata about the ESLint rules that were applied during the linting session.
 *                    The keys are the rule names, and the values are rule metadata objects
 *                     that describe each rule. This metadata typically includes:
 *                    - `docs`: Documentation about the rule.
 *                    - `fixable`: Indicates whether the rule is fixable.
 *                    - `messages`: Custom messages that the rule might output when triggered.
 *                    - `schema`: The configuration schema for the rule.
 *                    This metadata helps in providing more context about the rules when generating the SARIF log.
 * @param options - An object containing options for formatting:
 *                  - `ignoreSuppressed`: Boolean flag to decide whether to ignore suppressed messages.
 *                  - `eslintVersion`: Optional string to include the version of ESLint in the SARIF log.
 * @returns The SARIF log containing information about the linting results in SARIF format.
 */

export function formatEslintResultsAsSARIF(
  results: TEslint.ESLint.LintResult[],
  rulesMeta: TEslint.ESLint.LintResultData['rulesMeta'],
  options: ISerifFormatterOptions
): ISarifLog {
  const { ignoreSuppressed, eslintVersion, buildFolderPath } = options;
  const toolConfigurationNotifications: ISarifRepresentation[] = [];
  const sarifFiles: ISarifFile[] = [];
  const sarifResults: ISarifRepresentation[] = [];
  const sarifArtifactIndices: Map<string, number> = new Map();
  const sarifRules: ISarifRule[] = [];
  const sarifRuleIndices: Map<string, number> = new Map();

  const sarifRun: ISarifRun = {
    tool: {
      driver: {
        name: 'ESLint',
        informationUri: 'https://eslint.org',
        version: eslintVersion,
        fullName: `Eslint ${eslintVersion}`,
        rules: []
      }
    },
    automationDetails: {
      id: `ESLint-${eslintVersion}`
    }
  };

  const sarifLog: ISarifLog = {
    version: SARIF_VERSION,
    $schema: SARIF_INFORMATION_URI,
    runs: [sarifRun]
  };

  let executionSuccessful: boolean = true;
  let currentArtifactIndex: number = 0;
  let currentRuleIndex: number = 0;

  for (const result of results) {
    const { filePath } = result;
    const fileUrl: string = Path.convertToSlashes(path.relative(buildFolderPath, filePath));
    let sarifFileIndex: number | undefined = sarifArtifactIndices.get(fileUrl);

    if (sarifFileIndex === undefined) {
      sarifFileIndex = currentArtifactIndex++;
      sarifArtifactIndices.set(fileUrl, sarifFileIndex);
      sarifFiles.push({
        location: {
          uri: fileUrl
        }
      });
    }

    const artifactLocation: ISarifArtifactLocation = {
      uri: fileUrl,
      index: sarifFileIndex
    };

    const containsSuppressedMessages: boolean =
      result.suppressedMessages && result.suppressedMessages.length > 0;
    const messages: IMessage[] =
      containsSuppressedMessages && !ignoreSuppressed
        ? [...result.messages, ...result.suppressedMessages]
        : result.messages;

    for (const message of messages) {
      const level: string = message.fatal || message.severity === 2 ? 'error' : 'warning';
      const physicalLocation: ISarifPhysicalLocation = {
        artifactLocation
      };
      const messageIdHash: string = crypto.createHash('md5').update(message.message).digest('hex');
      const buildFolderPathHash: string = crypto.createHash('md5').update(fileUrl).digest('hex');

      const sarifRepresentation: ISarifRepresentation = {
        level,
        message: {
          text: message.message
        },
        locations: [
          {
            physicalLocation
          }
        ],
        partialFingerprints: {
          messageIdHash,
          buildFolderPathHash
        }
      };

      if (message.ruleId) {
        sarifRepresentation.ruleId = message.ruleId;
        const name: string = message.ruleId
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');
        const ruleIdHash: string = crypto.createHash('md5').update(message.ruleId).digest('hex');
        sarifRepresentation.partialFingerprints.ruleIdHash = ruleIdHash;

        if (rulesMeta && sarifRuleIndices.get(message.ruleId) === undefined) {
          const meta: TEslint.Rule.RuleMetaData = rulesMeta[message.ruleId];

          // An unknown ruleId will return null. This check prevents unit test failure.
          if (meta) {
            sarifRuleIndices.set(message.ruleId, currentRuleIndex++);

            if (meta.docs) {
              // Create a new entry in the rules dictionary.
              const shortDescription: string = meta.docs.description ?? '';

              const sarifRule: ISarifRule = {
                id: message.ruleId,
                helpUri: meta.docs.url,
                name,
                properties: {
                  category: meta.docs.category
                },
                shortDescription: {
                  text: shortDescription
                }
              };
              sarifRules.push(sarifRule);
              // Some rulesMetas do not have docs property
            } else {
              sarifRules.push({
                id: message.ruleId,
                name: 'NoCategoryProvided',
                properties: {
                  category: 'No category provided'
                },
                shortDescription: {
                  text: 'Please see details in message'
                }
              });
            }
          }
        }

        if (sarifRuleIndices.has(message.ruleId)) {
          sarifRepresentation.ruleIndex = sarifRuleIndices.get(message.ruleId);
        }

        if (containsSuppressedMessages && !ignoreSuppressed) {
          sarifRepresentation.suppressions = message.suppressions
            ? message.suppressions.map((suppression: ISuppressedAnalysis) => {
                return {
                  kind: suppression.kind === 'directive' ? 'inSource' : 'external',
                  justification: suppression.justification ?? ''
                };
              })
            : [];
        }
      } else {
        sarifRepresentation.descriptor = {
          id: INTERNAL_ERROR_ID
        };

        if (sarifRepresentation.level === 'error') {
          executionSuccessful = false;
        }
      }

      if (message.line !== undefined || message.column !== undefined) {
        const { line: startLine, column: startColumn, endLine, endColumn } = message;
        const region: IRegion = {
          startLine,
          startColumn,
          endLine,
          endColumn
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

  if (sarifRules.length > 0) {
    sarifRun.tool.driver.rules = sarifRules;
  }

  if (sarifFiles.length > 0) {
    sarifRun.artifacts = sarifFiles;
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
