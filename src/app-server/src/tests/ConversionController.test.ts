import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { ConversionController } from '../controllers/ConversionController';
import { PandocSocketClient, PandocRequest, PandocResponse } from '../types';

// Mock Express Request/Response
function createMockRequest(body: any = {}) {
  return { body } as any;
}

function createMockResponse() {
  const res = {
    status: mock.fn(() => res),
    json: mock.fn(() => res)
  } as any;
  return res;
}

// Mock PandocSocketClient
class MockPandocSocketClient implements PandocSocketClient {
  constructor(private shouldSucceed = true, private mockOutput = 'converted text') {}

  async sendRequest(request: PandocRequest): Promise<PandocResponse> {
    if (request.action === 'ping') {
      return { success: this.shouldSucceed };
    }
    
    if (request.action === 'convert') {
      if (!this.shouldSucceed) {
        return { success: false, error: 'Mock conversion failed' };
      }
      return { success: true, output: this.mockOutput };
    }
    
    return { success: false, error: 'Unknown action' };
  }

  async ping(): Promise<boolean> {
    return this.shouldSucceed;
  }

  async convert(input: string, fromFormat?: string, toFormat?: string): Promise<string> {
    if (!this.shouldSucceed) {
      throw new Error('Mock conversion failed');
    }
    return this.mockOutput;
  }
}

describe('ConversionController', () => {
  describe('convertSync', () => {
    it('should return converted text for valid input', async () => {
      const mockClient = new MockPandocSocketClient(true, '# Converted');
      const controller = new ConversionController(mockClient);
      const req = createMockRequest({ input: '# Hello World' });
      const res = createMockResponse();

      await controller.convertSync(req, res);

      assert.strictEqual(res.status.mock.callCount(), 0);
      assert.strictEqual(res.json.mock.callCount(), 1);
      
      const responseCall = res.json.mock.calls[0];
      const response = responseCall.arguments[0];
      
      assert.strictEqual(response.success, true);
      assert.strictEqual(response.data.output, '# Converted');
    });

    it('should return 400 for missing input', async () => {
      const mockClient = new MockPandocSocketClient();
      const controller = new ConversionController(mockClient);
      const req = createMockRequest({});
      const res = createMockResponse();

      await controller.convertSync(req, res);

      assert.strictEqual(res.status.mock.callCount(), 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
      
      const responseCall = res.json.mock.calls[0];
      const response = responseCall.arguments[0];
      
      assert.strictEqual(response.success, false);
      assert(response.error.includes('input field is required'));
    });

    it('should return 400 for empty input', async () => {
      const mockClient = new MockPandocSocketClient();
      const controller = new ConversionController(mockClient);
      const req = createMockRequest({ input: '   ' });
      const res = createMockResponse();

      await controller.convertSync(req, res);

      assert.strictEqual(res.status.mock.callCount(), 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
      
      const responseCall = res.json.mock.calls[0];
      const response = responseCall.arguments[0];
      
      assert.strictEqual(response.success, false);
      assert(response.error.includes('input cannot be empty'));
    });

    it('should return 503 when pandoc server is not available', async () => {
      const mockClient = new MockPandocSocketClient(false);
      const controller = new ConversionController(mockClient);
      const req = createMockRequest({ input: '# Hello' });
      const res = createMockResponse();

      await controller.convertSync(req, res);

      assert.strictEqual(res.status.mock.callCount(), 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 503);
      
      const responseCall = res.json.mock.calls[0];
      const response = responseCall.arguments[0];
      
      assert.strictEqual(response.success, false);
      assert(response.error.includes('Pandoc server is not available'));
    });

    it('should return 500 for conversion errors', async () => {
      const mockClient = new MockPandocSocketClient();
      // Override convert to throw error
      mockClient.convert = async () => {
        throw new Error('Conversion failed');
      };
      
      const controller = new ConversionController(mockClient);
      const req = createMockRequest({ input: '# Hello' });
      const res = createMockResponse();

      await controller.convertSync(req, res);

      assert.strictEqual(res.status.mock.callCount(), 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      
      const responseCall = res.json.mock.calls[0];
      const response = responseCall.arguments[0];
      
      assert.strictEqual(response.success, false);
      assert(response.error.includes('Conversion failed'));
    });
  });
});