import {
  parseSuiteAndTestName,
  buildRequestLog,
  buildResponseLog,
  wrapLongLines,
  reportBrunoResults,
} from './reporter';
import type { BrunoRequest, BrunoResponse, BrunoResults } from './types';

// Mock the Orangebeard client
const mockStartTestRun = jest.fn().mockReturnValue('test-run-uuid');
const mockStartSuite = jest.fn().mockReturnValue(['suite-uuid']);
const mockStartTest = jest.fn().mockReturnValue('test-uuid');
const mockStartStep = jest.fn().mockReturnValue('step-uuid');
const mockFinishStep = jest.fn();
const mockFinishTest = jest.fn();
const mockFinishTestRun = jest.fn();
const mockLog = jest.fn().mockReturnValue('log-uuid');

jest.mock('@orangebeard-io/javascript-client/dist/client/OrangebeardAsyncV3Client', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      config: { testset: 'Mock Test Set', description: 'Mock desc', attributes: [] },
      startTestRun: mockStartTestRun,
      startSuite: mockStartSuite,
      startTest: mockStartTest,
      startStep: mockStartStep,
      finishStep: mockFinishStep,
      finishTest: mockFinishTest,
      finishTestRun: mockFinishTestRun,
      log: mockLog,
    })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseSuiteAndTestName
// ---------------------------------------------------------------------------
describe('parseSuiteAndTestName', () => {
  it('parses a Windows-style path with .bru extension', () => {
    const result = parseSuiteAndTestName('Basic\\ChuckNorris\\ChuckNorris Facts.bru');
    expect(result).toEqual({
      suitePath: ['Basic', 'ChuckNorris'],
      testName: 'ChuckNorris Facts',
    });
  });

  it('parses a forward-slash path', () => {
    const result = parseSuiteAndTestName('Basic/ChuckNorris/ChuckNorris Facts.bru');
    expect(result).toEqual({
      suitePath: ['Basic', 'ChuckNorris'],
      testName: 'ChuckNorris Facts',
    });
  });

  it('handles a single filename with no folders', () => {
    const result = parseSuiteAndTestName('TestFile.bru');
    expect(result).toEqual({
      suitePath: [],
      testName: 'TestFile',
    });
  });

  it('handles deeply nested paths', () => {
    const result = parseSuiteAndTestName('A\\B\\C\\D\\Test.bru');
    expect(result).toEqual({
      suitePath: ['A', 'B', 'C', 'D'],
      testName: 'Test',
    });
  });

  it('handles filename without .bru extension', () => {
    const result = parseSuiteAndTestName('Folder\\Test');
    expect(result).toEqual({
      suitePath: ['Folder'],
      testName: 'Test',
    });
  });
});

// ---------------------------------------------------------------------------
// buildRequestLog
// ---------------------------------------------------------------------------
describe('buildRequestLog', () => {
  it('returns null when request has no method and no url', () => {
    const request: BrunoRequest = { method: null, url: null, headers: null, data: null };
    expect(buildRequestLog(request)).toBeNull();
  });

  it('builds markdown with method and url', () => {
    const request: BrunoRequest = {
      method: 'GET',
      url: 'https://example.com/api',
      headers: null,
      data: null,
    };
    const log = buildRequestLog(request)!;
    expect(log).toContain('### Request');
    expect(log).toContain('**URL:** https://example.com/api');
    expect(log).toContain('**Method:** GET');
  });

  it('includes headers table when present', () => {
    const request: BrunoRequest = {
      method: 'GET',
      url: 'https://example.com',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
      data: null,
    };
    const log = buildRequestLog(request)!;
    expect(log).toContain('**Headers**');
    expect(log).toContain('| content-type | application/json |');
    expect(log).toContain('| authorization | Bearer token |');
  });

  it('filters out null header values', () => {
    const request: BrunoRequest = {
      method: 'GET',
      url: 'https://example.com',
      headers: { 'content-type': null, accept: 'text/html' },
      data: null,
    };
    const log = buildRequestLog(request)!;
    expect(log).not.toContain('content-type');
    expect(log).toContain('| accept | text/html |');
  });

  it('renders object body as JSON', () => {
    const request: BrunoRequest = {
      method: 'POST',
      url: 'https://example.com',
      headers: { 'content-type': 'application/json' },
      data: { key: 'value' },
    };
    const log = buildRequestLog(request)!;
    expect(log).toContain('**Body (JSON)**');
    expect(log).toContain('"key": "value"');
  });

  it('renders string body with xml content-type as XML', () => {
    const request: BrunoRequest = {
      method: 'POST',
      url: 'https://example.com',
      headers: { 'content-type': 'application/xml' },
      data: '<root><item/></root>',
    };
    const log = buildRequestLog(request)!;
    expect(log).toContain('**Body (XML)**');
    expect(log).toContain('<root><item/></root>');
  });

  it('renders plain text body when content type is unknown', () => {
    const request: BrunoRequest = {
      method: 'POST',
      url: 'https://example.com',
      headers: { 'content-type': 'text/plain' },
      data: 'hello world',
    };
    const log = buildRequestLog(request)!;
    expect(log).toContain('**Body**');
    expect(log).toContain('hello world');
  });
});

// ---------------------------------------------------------------------------
// buildResponseLog
// ---------------------------------------------------------------------------
describe('buildResponseLog', () => {
  it('returns null for error placeholder response', () => {
    const response: BrunoResponse = {
      status: 'error',
      statusText: null,
      headers: null,
      data: null,
      url: null,
      responseTime: 0,
    };
    expect(buildResponseLog(response)).toBeNull();
  });

  it('builds markdown with numeric status and statusText', () => {
    const response: BrunoResponse = {
      status: 200,
      statusText: 'OK',
      headers: null,
      data: null,
      url: 'https://example.com/api',
      responseTime: 150,
    };
    const log = buildResponseLog(response)!;
    expect(log).toContain('### Response');
    expect(log).toContain('**Code:** 200');
    expect(log).toContain('**Status:** OK');
    expect(log).toContain('**URL:** https://example.com/api');
    expect(log).toContain('**Response Time:** 150 ms');
  });

  it('omits response time when zero', () => {
    const response: BrunoResponse = {
      status: 200,
      statusText: 'OK',
      headers: null,
      data: null,
      url: null,
      responseTime: 0,
    };
    const log = buildResponseLog(response)!;
    expect(log).not.toContain('Response Time');
  });

  it('includes headers with array values joined', () => {
    const response: BrunoResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'set-cookie': ['a=1', 'b=2'] },
      data: null,
      url: null,
      responseTime: 0,
    };
    const log = buildResponseLog(response)!;
    expect(log).toContain('| set-cookie | a=1; b=2 |');
  });

  it('renders object data as JSON body', () => {
    const response: BrunoResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { result: true },
      url: null,
      responseTime: 100,
    };
    const log = buildResponseLog(response)!;
    expect(log).toContain('**Body (JSON)**');
    expect(log).toContain('"result": true');
  });

  it('renders string data with xml content-type as XML body', () => {
    const response: BrunoResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/xml' },
      data: '<metadata/>',
      url: null,
      responseTime: 50,
    };
    const log = buildResponseLog(response)!;
    expect(log).toContain('**Body (XML)**');
    expect(log).toContain('<metadata/>');
  });
});

// ---------------------------------------------------------------------------
// wrapLongLines
// ---------------------------------------------------------------------------
describe('wrapLongLines', () => {
  it('returns empty string for empty input', () => {
    expect(wrapLongLines('')).toBe('');
  });

  it('leaves short lines unchanged', () => {
    expect(wrapLongLines('short line')).toBe('short line');
  });

  it('wraps a single long line at maxLineLength', () => {
    const line = 'a'.repeat(300);
    const result = wrapLongLines(line, 100);
    const lines = result.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveLength(100);
    expect(lines[1]).toHaveLength(100);
    expect(lines[2]).toHaveLength(100);
  });

  it('preserves short lines and wraps long lines in multi-line input', () => {
    const input = 'short\n' + 'x'.repeat(20);
    const result = wrapLongLines(input, 10);
    const lines = result.split('\n');
    expect(lines[0]).toBe('short');
    expect(lines[1]).toBe('x'.repeat(10));
    expect(lines[2]).toBe('x'.repeat(10));
  });
});

// ---------------------------------------------------------------------------
// reportBrunoResults (integration with mocked client)
// ---------------------------------------------------------------------------
describe('reportBrunoResults', () => {
  function makeResult(overrides: Record<string, unknown> = {}) {
    return {
      test: { filename: 'Suite\\Test.bru' },
      request: { method: 'GET', url: 'https://example.com', headers: null, data: null },
      response: {
        status: 200,
        statusText: 'OK',
        headers: null,
        data: null,
        url: null,
        responseTime: 100,
      },
      status: 'pass',
      error: null,
      assertionResults: [],
      testResults: [],
      preRequestTestResults: [],
      postResponseTestResults: [],
      runDuration: 0.5,
      name: 'Test',
      path: 'Suite\\Test',
      iterationIndex: 0,
      ...overrides,
    };
  }

  function makeResults(results: ReturnType<typeof makeResult>[]): BrunoResults {
    return [{ iterationIndex: 0, results }] as unknown as BrunoResults;
  }

  it('starts and finishes a test run', () => {
    reportBrunoResults(makeResults([makeResult()]));

    expect(mockStartTestRun).toHaveBeenCalledTimes(1);
    expect(mockFinishTestRun).toHaveBeenCalledTimes(1);
  });

  it('creates suites from the filename path', () => {
    const results = makeResults([
      makeResult({ test: { filename: 'A\\B\\Test.bru' } }),
    ]);
    reportBrunoResults(results);

    // Should create suite A, then suite B under A
    expect(mockStartSuite).toHaveBeenCalledTimes(2);
    expect(mockStartSuite).toHaveBeenCalledWith(
      expect.objectContaining({ suiteNames: ['A'] }),
    );
    expect(mockStartSuite).toHaveBeenCalledWith(
      expect.objectContaining({ suiteNames: ['B'], parentSuiteUUID: 'suite-uuid' }),
    );
  });

  it('reuses cached suites for the same path', () => {
    const results = makeResults([
      makeResult({ test: { filename: 'Suite\\Test1.bru' }, name: 'Test1' }),
      makeResult({ test: { filename: 'Suite\\Test2.bru' }, name: 'Test2' }),
    ]);
    reportBrunoResults(results);

    // Suite should only be created once
    expect(mockStartSuite).toHaveBeenCalledTimes(1);
    expect(mockStartTest).toHaveBeenCalledTimes(2);
  });

  it('creates a test with Method and Status attributes', () => {
    reportBrunoResults(makeResults([makeResult()]));

    expect(mockStartTest).toHaveBeenCalledWith(
      expect.objectContaining({
        testName: 'Test',
        attributes: [
          { key: 'Method', value: 'GET' },
          { key: 'Status', value: '200 - OK' },
        ],
      }),
    );
  });

  it('formats Status attribute without statusText when null', () => {
    const results = makeResults([
      makeResult({
        response: { status: 204, statusText: null, headers: null, data: null, url: null, responseTime: 50 },
      }),
    ]);
    reportBrunoResults(results);

    expect(mockStartTest).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.arrayContaining([{ key: 'Status', value: '204' }]),
      }),
    );
  });

  it('logs request and response as INFO markdown', () => {
    reportBrunoResults(makeResults([makeResult()]));

    const infoCalls = mockLog.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).logLevel === 'INFO',
    );
    // Request log + response log
    expect(infoCalls.length).toBe(2);
    expect((infoCalls[0][0] as Record<string, string>).message).toContain('### Request');
    expect((infoCalls[1][0] as Record<string, string>).message).toContain('### Response');
  });

  it('skips request log when method and url are null', () => {
    const results = makeResults([
      makeResult({
        request: { method: null, url: null, headers: null, data: null },
      }),
    ]);
    reportBrunoResults(results);

    const infoCalls = mockLog.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).logLevel === 'INFO',
    );
    // Only response log (no request log)
    expect(infoCalls.length).toBe(1);
    expect((infoCalls[0][0] as Record<string, string>).message).toContain('### Response');
  });

  it('creates steps for assertion results', () => {
    const results = makeResults([
      makeResult({
        assertionResults: [
          { uid: '1', lhsExpr: 'res.status', rhsExpr: 'eq 200', rhsOperand: '200', operator: 'eq', status: 'pass' },
          { uid: '2', lhsExpr: 'res.body.id', rhsExpr: 'isString', rhsOperand: '', operator: 'isString', status: 'pass' },
        ],
      }),
    ]);
    reportBrunoResults(results);

    expect(mockStartStep).toHaveBeenCalledTimes(2);
    expect(mockStartStep).toHaveBeenCalledWith(
      expect.objectContaining({ stepName: 'res.status eq 200' }),
    );
    expect(mockStartStep).toHaveBeenCalledWith(
      expect.objectContaining({ stepName: 'res.body.id isString' }),
    );
    expect(mockFinishStep).toHaveBeenCalledTimes(2);
    // Both passed
    expect(mockFinishStep).toHaveBeenCalledWith(
      'step-uuid',
      expect.objectContaining({ status: 'PASSED' }),
    );
  });

  it('creates steps for test results', () => {
    const results = makeResults([
      makeResult({
        testResults: [
          { description: 'Status should be 200', status: 'pass', uid: 't1' },
        ],
      }),
    ]);
    reportBrunoResults(results);

    expect(mockStartStep).toHaveBeenCalledWith(
      expect.objectContaining({ stepName: 'Status should be 200' }),
    );
    expect(mockFinishStep).toHaveBeenCalledWith(
      'step-uuid',
      expect.objectContaining({ status: 'PASSED' }),
    );
  });

  it('fails step and test on failed assertion with error log', () => {
    const results = makeResults([
      makeResult({
        assertionResults: [
          {
            uid: '1', lhsExpr: 'res.status', rhsExpr: 'eq 200', rhsOperand: '200',
            operator: 'eq', status: 'fail', error: 'expected 404 to equal 200',
          },
        ],
      }),
    ]);
    reportBrunoResults(results);

    // Step finished as FAILED
    expect(mockFinishStep).toHaveBeenCalledWith(
      'step-uuid',
      expect.objectContaining({ status: 'FAILED' }),
    );

    // Error log under the step
    const errorCalls = mockLog.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).logLevel === 'ERROR',
    );
    expect(errorCalls.length).toBe(1);
    expect((errorCalls[0][0] as Record<string, unknown>).stepUUID).toBe('step-uuid');
    expect((errorCalls[0][0] as Record<string, string>).message).toContain('expected 404 to equal 200');

    // Test finished as FAILED
    expect(mockFinishTest).toHaveBeenCalledWith(
      'test-uuid',
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('fails step and test on failed testResult with error log', () => {
    const results = makeResults([
      makeResult({
        testResults: [
          { description: 'Should pass', status: 'fail', uid: 't1', error: 'assertion failed' },
        ],
      }),
    ]);
    reportBrunoResults(results);

    expect(mockFinishStep).toHaveBeenCalledWith(
      'step-uuid',
      expect.objectContaining({ status: 'FAILED' }),
    );

    const errorCalls = mockLog.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).logLevel === 'ERROR',
    );
    expect(errorCalls.length).toBe(1);
    expect((errorCalls[0][0] as Record<string, string>).message).toContain('assertion failed');

    expect(mockFinishTest).toHaveBeenCalledWith(
      'test-uuid',
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('logs top-level error and fails the test', () => {
    const results = makeResults([
      makeResult({
        status: 'error',
        error: 'Error: Cannot find module @faker-js/faker',
        request: { method: null, url: null, headers: null, data: null },
        response: { status: 'error', statusText: null, headers: null, data: null, url: null, responseTime: 0 },
      }),
    ]);
    reportBrunoResults(results);

    const errorCalls = mockLog.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).logLevel === 'ERROR',
    );
    expect(errorCalls.length).toBe(1);
    expect((errorCalls[0][0] as Record<string, string>).message).toContain('Cannot find module');

    expect(mockFinishTest).toHaveBeenCalledWith(
      'test-uuid',
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('appends iteration index to test name for multiple iterations', () => {
    const results: BrunoResults = [
      { iterationIndex: 0, results: [makeResult()] },
      { iterationIndex: 1, results: [makeResult()] },
    ] as unknown as BrunoResults;
    reportBrunoResults(results);

    expect(mockStartTest).toHaveBeenCalledTimes(2);
    expect(mockStartTest).toHaveBeenCalledWith(
      expect.objectContaining({ testName: 'Test #1' }),
    );
    expect(mockStartTest).toHaveBeenCalledWith(
      expect.objectContaining({ testName: 'Test #2' }),
    );
  });

  it('does not append iteration index for single iteration', () => {
    reportBrunoResults(makeResults([makeResult()]));

    expect(mockStartTest).toHaveBeenCalledWith(
      expect.objectContaining({ testName: 'Test' }),
    );
  });

  it('finishes test run with accumulated duration', () => {
    const results = makeResults([
      makeResult({ runDuration: 0.2 }),
      makeResult({ test: { filename: 'Suite\\Test2.bru' }, runDuration: 0.3 }),
    ]);
    reportBrunoResults(results);

    // Both tests finished, run finished
    expect(mockFinishTest).toHaveBeenCalledTimes(2);
    expect(mockFinishTestRun).toHaveBeenCalledTimes(1);

    // Verify that test end times and run end time are based on accumulated duration
    // Test 1 start = runStart, end = runStart + 200ms
    // Test 2 start = runStart + 200ms, end = runStart + 500ms
    // Run end = runStart + 500ms
    const test1End = mockFinishTest.mock.calls[0][1].endTime;
    const test2Start = mockStartTest.mock.calls[1][0].startTime;
    const test2End = mockFinishTest.mock.calls[1][1].endTime;
    const runEnd = mockFinishTestRun.mock.calls[0][1].endTime;

    // test2 should start where test1 ended
    expect(test2Start).toBe(test1End);
    // run end should equal test2 end
    expect(runEnd).toBe(test2End);
  });
});
