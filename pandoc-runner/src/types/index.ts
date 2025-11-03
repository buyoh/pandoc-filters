// 共通の型定義
export interface ConversionRequest {
  action: 'convert';
  from: string;
  to: string;
  content: string;
}

export interface PingRequest {
  action: 'ping';
}

export type Request = ConversionRequest | PingRequest;

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
  };
  timestamp: string;
}

export type Response = SuccessResponse | ErrorResponse;

export interface ConversionResult {
  result: string;
  from: string;
  to: string;
}

export interface PingResult {
  message: string;
}

export interface FilterSelector {
  getFilterPath(fromFormat: string, toFormat: string): string | null;
}

export interface CommandExecutor {
  execute(command: string, args: string[], options?: { stdin?: string }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}

export interface Logger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}
