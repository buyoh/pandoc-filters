import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PandocSocketClient, PandocRequest, PandocResponse } from '../types';

// Simple mock implementation for interface testing
class SimpleMockPandocClient implements PandocSocketClient {
  async sendRequest(request: PandocRequest): Promise<PandocResponse> {
    return { 
      success: true, 
      data: { result: 'mocked response' },
      timestamp: new Date().toISOString()
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async convert(input: string, fromFormat?: string, toFormat?: string): Promise<string> {
    return `Converted: ${input}`;
  }
}

// Failing mock implementation
class FailingMockPandocClient implements PandocSocketClient {
  async sendRequest(request: PandocRequest): Promise<PandocResponse> {
    return { 
      success: false, 
      error: { message: 'Connection failed', code: 'CONNECTION_ERROR' },
      timestamp: new Date().toISOString()
    };
  }

  async ping(): Promise<boolean> {
    return false;
  }

  async convert(input: string, fromFormat?: string, toFormat?: string): Promise<string> {
    throw new Error('Service unavailable');
  }
}

describe('PandocSocketClient', () => {
  describe('SimpleMockPandocClient', () => {
    it('should implement ping method', async () => {
      const client = new SimpleMockPandocClient();
      const result = await client.ping();
      assert.strictEqual(result, true);
    });

    it('should implement convert method', async () => {
      const client = new SimpleMockPandocClient();
      const result = await client.convert('# Test', 'markdown', 'textile');
      assert.strictEqual(result, 'Converted: # Test');
    });

    it('should implement sendRequest method', async () => {
      const client = new SimpleMockPandocClient();
      const result = await client.sendRequest({ action: 'ping' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.result, 'mocked response');
    });
  });

  describe('FailingMockPandocClient', () => {
    it('should return false for ping', async () => {
      const client = new FailingMockPandocClient();
      const result = await client.ping();
      assert.strictEqual(result, false);
    });

    it('should throw error for convert', async () => {
      const client = new FailingMockPandocClient();
      await assert.rejects(
        () => client.convert('# Test'),
        { message: 'Service unavailable' }
      );
    });

    it('should return failure response for sendRequest', async () => {
      const client = new FailingMockPandocClient();
      const result = await client.sendRequest({ action: 'convert', content: 'test' });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.message, 'Connection failed');
    });
  });

  describe('Interface compatibility', () => {
    it('should accept any implementation of PandocSocketClient', () => {
      const clients: PandocSocketClient[] = [
        new SimpleMockPandocClient(),
        new FailingMockPandocClient()
      ];

      // All implementations should have the required methods
      clients.forEach(client => {
        assert(typeof client.ping === 'function');
        assert(typeof client.convert === 'function');
        assert(typeof client.sendRequest === 'function');
      });
    });
  });
});