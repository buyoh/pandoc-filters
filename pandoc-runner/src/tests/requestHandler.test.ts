import { RequestHandler } from '../src/requestHandler';
import { PandocConverter } from '../src/pandocConverter';
import { ConversionError } from '../src/types';

// モックの作成
const mockConverter = {
  convertMarkdownToRedmineTextile: jest.fn(),
} as jest.Mocked<PandocConverter>;

describe('RequestHandler', () => {
  let handler: RequestHandler;

  beforeEach(() => {
    handler = new RequestHandler(mockConverter);
    jest.clearAllMocks();
  });

  describe('handleRequest', () => {
    it('should handle convert request successfully', async () => {
      const mockResult = 'converted textile content';
      mockConverter.convertMarkdownToRedmineTextile.mockResolvedValue(mockResult);

      const request = JSON.stringify({
        action: 'convert',
        from: 'markdown',
        to: 'redmine-textile',
        content: '# Hello World'
      });

      const response = await handler.handleRequest(request);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.data.result).toBe(mockResult);
      expect(parsedResponse.data.from).toBe('markdown');
      expect(parsedResponse.data.to).toBe('redmine-textile');
      expect(mockConverter.convertMarkdownToRedmineTextile).toHaveBeenCalledWith('# Hello World');
    });

    it('should handle ping request', async () => {
      const request = JSON.stringify({ action: 'ping' });

      const response = await handler.handleRequest(request);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.data.message).toBe('pong');
    });

    it('should handle invalid JSON', async () => {
      const response = await handler.handleRequest('invalid json');
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error.code).toBe('INVALID_JSON');
    });

    it('should handle unknown action', async () => {
      const request = JSON.stringify({ action: 'unknown' });

      const response = await handler.handleRequest(request);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error.code).toBe('UNKNOWN_ACTION');
    });

    it('should handle unsupported conversion', async () => {
      const request = JSON.stringify({
        action: 'convert',
        from: 'html',
        to: 'markdown',
        content: '<h1>Hello</h1>'
      });

      const response = await handler.handleRequest(request);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error.code).toBe('UNSUPPORTED_CONVERSION');
    });

    it('should handle conversion error', async () => {
      const errorMessage = 'Pandoc failed';
      mockConverter.convertMarkdownToRedmineTextile.mockRejectedValue(new ConversionError(errorMessage));

      const request = JSON.stringify({
        action: 'convert',
        from: 'markdown',
        to: 'redmine-textile',
        content: '# Hello'
      });

      const response = await handler.handleRequest(request);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error.code).toBe('CONVERSION_ERROR');
      expect(parsedResponse.error.message).toContain(errorMessage);
    });

    it('should handle missing required fields', async () => {
      const request = JSON.stringify({
        action: 'convert',
        from: 'markdown'
        // missing 'to' and 'content'
      });

      const response = await handler.handleRequest(request);
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.success).toBe(false);
      expect(parsedResponse.error.code).toBe('INTERNAL_ERROR');
    });
  });
});