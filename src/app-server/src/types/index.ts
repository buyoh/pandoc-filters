export interface ConversionRequest {
  input: string;
  from_format?: string;
  to_format?: string;
}

export interface ConversionResponse {
  success: boolean;
  output?: string;
  error?: string;
}

export interface PandocRequest {
  action: 'convert' | 'ping';
  input?: string;
  from_format?: string;
  to_format?: string;
}

export interface PandocResponse {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}