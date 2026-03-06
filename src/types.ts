export interface BrunoAssertionResult {
  uid: string;
  lhsExpr: string;
  rhsExpr: string;
  rhsOperand: string;
  operator: string;
  status: 'pass' | 'fail';
  error?: string;
}

export interface BrunoTestResult {
  description: string;
  status: 'pass' | 'fail';
  uid: string;
  error?: string;
}

export interface BrunoRequest {
  method: string | null;
  url: string | null;
  headers: Record<string, string | null> | null;
  data: unknown;
}

export interface BrunoResponse {
  status: number | 'error';
  statusText: string | null;
  headers: Record<string, string | string[] | null> | null;
  data: unknown;
  url: string | null;
  responseTime: number;
}

export interface BrunoResult {
  test: {
    filename: string;
  };
  request: BrunoRequest;
  response: BrunoResponse;
  status: 'pass' | 'fail' | 'error';
  error: string | null;
  assertionResults: BrunoAssertionResult[];
  testResults: BrunoTestResult[];
  preRequestTestResults: unknown[];
  postResponseTestResults: unknown[];
  runDuration: number;
  name: string;
  path: string;
  iterationIndex: number;
}

export interface BrunoIteration {
  iterationIndex: number;
  results: BrunoResult[];
}

export type BrunoResults = BrunoIteration[];
