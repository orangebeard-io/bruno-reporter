import OrangebeardAsyncV3Client from '@orangebeard-io/javascript-client/dist/client/OrangebeardAsyncV3Client';
import { UUID } from 'crypto';
import { ZonedDateTime, ChronoUnit } from '@js-joda/core';
import { FinishStep } from '@orangebeard-io/javascript-client/dist/client/models/FinishStep';
import { FinishTest } from '@orangebeard-io/javascript-client/dist/client/models/FinishTest';
import type { Attribute } from '@orangebeard-io/javascript-client/dist/client/models/Attribute';
import type { BrunoRequest, BrunoResponse, BrunoResults, BrunoIteration } from './types';

const TestStatus = {
  PASSED: 'PASSED' as FinishTest.Status,
  FAILED: 'FAILED' as FinishTest.Status,
};

function getTime(): string {
  return ZonedDateTime.now().withFixedOffsetZone().toString();
}

/**
 * Parse the test.filename into a suite path and test name.
 * e.g. "Basic\\ChuckNorris\\ChuckNorris Facts.bru"
 *   -> suitePath: ["Basic", "ChuckNorris"], testName: "ChuckNorris Facts"
 */
export function parseSuiteAndTestName(filename: string): { suitePath: string[]; testName: string } {
  const normalized = filename.replace(/\\/g, '/').replace(/\.bru$/, '');
  const parts = normalized.split('/');
  const testName = parts[parts.length - 1];
  const suitePath = parts.slice(0, -1);
  return { suitePath, testName };
}

/**
 * Recursively get or create suites for the given path.
 */
function getOrCreateSuite(
  client: OrangebeardAsyncV3Client,
  testRunUUID: UUID,
  suitePath: string[],
  suiteCache: Map<string, UUID>,
): UUID | null {
  if (suitePath.length === 0) return null;

  const pathKey = suitePath.join('/');
  if (suiteCache.has(pathKey)) {
    return suiteCache.get(pathKey)!;
  }

  const parentPath = suitePath.slice(0, -1);
  const parentSuiteUUID =
    parentPath.length > 0
      ? getOrCreateSuite(client, testRunUUID, parentPath, suiteCache)
      : undefined;

  const suiteUUIDs = client.startSuite({
    testRunUUID,
    parentSuiteUUID: parentSuiteUUID as UUID | undefined,
    suiteNames: [suitePath[suitePath.length - 1]],
  });

  const suiteUUID = Array.isArray(suiteUUIDs) ? suiteUUIDs[0] : suiteUUIDs;
  suiteCache.set(pathKey, suiteUUID);
  return suiteUUID;
}

/**
 * Build a markdown log for the request.
 */
export function buildRequestLog(request: BrunoRequest): string | null {
  if (!request || (!request.method && !request.url)) return null;

  let message = '### Request\n\n';
  message += '**Meta**\n\n';

  if (request.url) {
    message += `- **URL:** ${request.url}\n`;
  }
  if (request.method) {
    message += `- **Method:** ${request.method}\n`;
  }
  message += '\n';

  if (request.headers && typeof request.headers === 'object') {
    const entries = Object.entries(request.headers).filter(([, v]) => v != null);
    if (entries.length > 0) {
      message += '**Headers**\n\n';
      message += '| Key | Value |\n';
      message += '| --- | ----- |\n';
      entries.forEach(([key, value]) => {
        message += `| ${key} | ${value} |\n`;
      });
      message += '\n';
    }
  }

  if (request.data) {
    const contentType = request.headers?.['content-type'] || '';
    let bodyStr: string;
    let format = 'text';

    if (typeof request.data === 'object') {
      bodyStr = JSON.stringify(request.data, null, 2);
      format = 'json';
    } else {
      bodyStr = String(request.data);
      if (contentType.includes('json')) format = 'json';
      else if (contentType.includes('xml')) format = 'xml';
    }

    if (format === 'json') {
      message += '**Body (JSON)**\n```json\n';
    } else if (format === 'xml') {
      message += '**Body (XML)**\n```xml\n';
    } else {
      message += '**Body**\n```text\n';
    }
    message += `${bodyStr}\n`;
    message += '```\n';
  }

  return message;
}

/**
 * Build a markdown log for the response.
 */
export function buildResponseLog(response: BrunoResponse): string | null {
  if (!response) return null;
  if (response.status === 'error' && !response.statusText && !response.data) return null;

  let message = '### Response\n\n';
  message += '**Meta**\n\n';

  if (typeof response.status === 'number') {
    message += `- **Code:** ${response.status}\n`;
  }
  if (response.statusText) {
    message += `- **Status:** ${response.statusText}\n`;
  }
  if (response.url) {
    message += `- **URL:** ${response.url}\n`;
  }
  if (typeof response.responseTime === 'number' && response.responseTime > 0) {
    message += `- **Response Time:** ${response.responseTime} ms\n`;
  }
  message += '\n';

  if (response.headers && typeof response.headers === 'object') {
    const entries = Object.entries(response.headers).filter(([, v]) => v != null);
    if (entries.length > 0) {
      message += '**Headers**\n\n';
      message += '| Key | Value |\n';
      message += '| --- | ----- |\n';
      entries.forEach(([key, value]) => {
        const displayValue = Array.isArray(value) ? value.join('; ') : value;
        message += `| ${key} | ${displayValue} |\n`;
      });
      message += '\n';
    }
  }

  if (response.data) {
    const contentType = (response.headers?.['content-type'] as string) || '';
    let bodyStr: string;
    let format = 'text';

    if (typeof response.data === 'object') {
      bodyStr = JSON.stringify(response.data, null, 2);
      format = 'json';
    } else {
      bodyStr = String(response.data);
      if (contentType.includes('xml')) format = 'xml';
    }

    if (format === 'json') {
      message += '**Body (JSON)**\n```json\n';
    } else if (format === 'xml') {
      message += '**Body (XML)**\n```xml\n';
    } else {
      message += '**Body**\n```text\n';
    }
    message += `${bodyStr}\n`;
    message += '```\n';
  }

  return message;
}

export function wrapLongLines(message: string, maxLineLength = 255): string {
  if (!message) return '';

  const lines = message.split('\n');
  const wrappedLines: string[] = [];

  for (const line of lines) {
    if (line.length <= maxLineLength) {
      wrappedLines.push(line);
    } else {
      let remaining = line;
      while (remaining.length > 0) {
        wrappedLines.push(remaining.substring(0, maxLineLength));
        remaining = remaining.substring(maxLineLength);
      }
    }
  }

  return wrappedLines.join('\n');
}

/**
 * Report Bruno CLI JSON results to Orangebeard.
 */
export function reportBrunoResults(results: BrunoResults): void {
  const client = new OrangebeardAsyncV3Client();
  const config = client.config || ({} as Record<string, unknown>);

  const runStartZoned = ZonedDateTime.now().withFixedOffsetZone();
  const startTime = runStartZoned.toString();
  const testRunUUID = client.startTestRun({
    testSetName:
      process.env.ORANGEBEARD_TESTSET || (config.testset as string) || 'Bruno Test Run',
    description: config.description as string | undefined,
    attributes: (config.attributes as Array<{ key?: string; value: string }>) || [],
    startTime,
  });

  const suiteCache = new Map<string, UUID>();
  const iterations: BrunoIteration[] = Array.isArray(results) ? results : [results];
  const multipleIterations = iterations.length > 1;
  let accumulatedMs = 0;

  for (const iteration of iterations) {
    const iterationResults = iteration.results || [];
    const iterationIndex = iteration.iterationIndex;

    for (const result of iterationResults) {
      const { suitePath, testName: baseTestName } = parseSuiteAndTestName(result.test.filename);
      const testName = multipleIterations
        ? `${baseTestName} #${iterationIndex + 1}`
        : baseTestName;

      const suiteUUID = getOrCreateSuite(client, testRunUUID, suitePath, suiteCache);

      const durationMs = Math.round(result.runDuration * 1000);
      const testStartZoned = runStartZoned.plus(accumulatedMs, ChronoUnit.MILLIS);
      const testStartTime = testStartZoned.toString();
      const testEndTime = testStartZoned.plus(durationMs, ChronoUnit.MILLIS).toString();
      accumulatedMs += durationMs;

      const testAttributes: Attribute[] = [];
      if (result.request?.method) {
        testAttributes.push({ key: 'Method', value: result.request.method });
      }
      if (typeof result.response?.status === 'number') {
        const statusValue = result.response.statusText
          ? `${result.response.status} - ${result.response.statusText}`
          : String(result.response.status);
        testAttributes.push({ key: 'Status', value: statusValue });
      }

      const testUUID = client.startTest({
        testRunUUID,
        suiteUUID: suiteUUID as UUID,
        testName,
        testType: 'TEST' as never,
        startTime: testStartTime,
        attributes: testAttributes,
      });

      let testStatus = TestStatus.PASSED;

      // Log request info
      const requestLog = buildRequestLog(result.request);
      if (requestLog) {
        client.log({
          testRunUUID,
          testUUID,
          logTime: testStartTime,
          message: wrapLongLines(requestLog),
          logLevel: 'INFO' as never,
          logFormat: 'MARKDOWN' as never,
        });
      }

      // Log response info
      const responseLog = buildResponseLog(result.response);
      if (responseLog) {
        client.log({
          testRunUUID,
          testUUID,
          logTime: testStartTime,
          message: wrapLongLines(responseLog),
          logLevel: 'INFO' as never,
          logFormat: 'MARKDOWN' as never,
        });
      }

      // Log top-level error
      if (result.error) {
        testStatus = TestStatus.FAILED;
        client.log({
          testRunUUID,
          testUUID,
          logTime: testStartTime,
          message: wrapLongLines(
            typeof result.error === 'string' ? result.error : JSON.stringify(result.error),
          ),
          logLevel: 'ERROR' as never,
          logFormat: 'MARKDOWN' as never,
        });
      }

      // Process assertionResults as steps
      for (const assertion of result.assertionResults || []) {
        const stepName = `${assertion.lhsExpr} ${assertion.rhsExpr}`;
        const stepUUID = client.startStep({
          testRunUUID,
          testUUID,
          stepName,
          startTime: testStartTime,
        });

        const stepStatus: FinishStep.Status =
          assertion.status === 'pass' ? TestStatus.PASSED : TestStatus.FAILED;

        if (stepStatus === TestStatus.FAILED) {
          testStatus = TestStatus.FAILED;
          if (assertion.error) {
            client.log({
              testRunUUID,
              testUUID,
              stepUUID,
              logTime: testStartTime,
              message: wrapLongLines(assertion.error),
              logLevel: 'ERROR' as never,
              logFormat: 'MARKDOWN' as never,
            });
          }
        }

        client.finishStep(stepUUID, {
          testRunUUID,
          status: stepStatus,
          endTime: testEndTime,
        });
      }

      // Process testResults as steps
      for (const testResult of result.testResults || []) {
        const stepName = testResult.description;
        const stepUUID = client.startStep({
          testRunUUID,
          testUUID,
          stepName,
          startTime: testStartTime,
        });

        const stepStatus: FinishStep.Status =
          testResult.status === 'pass' ? TestStatus.PASSED : TestStatus.FAILED;

        if (stepStatus === TestStatus.FAILED) {
          testStatus = TestStatus.FAILED;
          if (testResult.error) {
            client.log({
              testRunUUID,
              testUUID,
              stepUUID,
              logTime: testStartTime,
              message: wrapLongLines(
                typeof testResult.error === 'string'
                  ? testResult.error
                  : JSON.stringify(testResult.error),
              ),
              logLevel: 'ERROR' as never,
              logFormat: 'MARKDOWN' as never,
            });
          }
        }

        client.finishStep(stepUUID, {
          testRunUUID,
          status: stepStatus,
          endTime: testEndTime,
        });
      }

      // Ensure top-level error/fail status is reflected
      if (result.status === 'error' || result.status === 'fail') {
        testStatus = TestStatus.FAILED;
      }

      client.finishTest(testUUID, {
        testRunUUID,
        status: testStatus,
        endTime: testEndTime,
      });
    }
  }

  const runEndTime = runStartZoned.plus(accumulatedMs, ChronoUnit.MILLIS).toString();
  client.finishTestRun(testRunUUID, {
    endTime: runEndTime,
  });
}
