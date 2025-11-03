import { PandocConverter, DefaultFilterSelector } from '../src/pandocConverter';
import { CommandExecutor, ConversionError } from '../src/types';

// モックのCommandExecutor
const mockCommandExecutor: jest.Mocked<CommandExecutor> = {
  execute: jest.fn(),
};

describe('PandocConverter', () => {
  let converter: PandocConverter;

  beforeEach(() => {
    converter = new PandocConverter(mockCommandExecutor, new DefaultFilterSelector());
    jest.clearAllMocks();
  });

  describe('validatePandocAvailability', () => {
    it('should pass when pandoc is available', async () => {
      mockCommandExecutor.execute.mockResolvedValue({
        stdout: 'pandoc 2.19.2',
        stderr: '',
        exitCode: 0,
      });

      await expect(converter.validatePandocAvailability()).resolves.not.toThrow();
      expect(mockCommandExecutor.execute).toHaveBeenCalledWith('pandoc', ['--version']);
    });

    it('should throw when pandoc command fails', async () => {
      mockCommandExecutor.execute.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 1,
      });

      await expect(converter.validatePandocAvailability()).rejects.toThrow(ConversionError);
    });

    it('should throw when pandoc command not found', async () => {
      const notFoundError = new Error('ENOENT');
      mockCommandExecutor.execute.mockRejectedValue(notFoundError);

      await expect(converter.validatePandocAvailability()).rejects.toThrow(ConversionError);
    });
  });

  describe('convertMarkdownToRedmineTextile', () => {
    it('should convert markdown to textile successfully', async () => {
      const expectedOutput = 'h1. Hello World';
      mockCommandExecutor.execute.mockResolvedValue({
        stdout: expectedOutput,
        stderr: '',
        exitCode: 0,
      });

      const result = await converter.convertMarkdownToRedmineTextile('# Hello World');

      expect(result).toBe(expectedOutput);
      expect(mockCommandExecutor.execute).toHaveBeenCalledWith(
        'pandoc',
        ['-f', 'markdown', '-t', 'textile'],
        { stdin: '# Hello World' }
      );
    });

    it('should throw ConversionError when pandoc fails', async () => {
      mockCommandExecutor.execute.mockResolvedValue({
        stdout: '',
        stderr: 'pandoc: error message',
        exitCode: 1,
      });

      await expect(converter.convertMarkdownToRedmineTextile('# Hello'))
        .rejects.toThrow(ConversionError);
    });

    it('should throw Error for invalid input type', async () => {
      await expect((converter.convertMarkdownToRedmineTextile as any)(123))
        .rejects.toThrow('markdownText must be a string');
    });

    it('should throw ConversionError when command not found', async () => {
      const notFoundError = new Error('ENOENT');
      mockCommandExecutor.execute.mockRejectedValue(notFoundError);

      await expect(converter.convertMarkdownToRedmineTextile('# Hello'))
        .rejects.toThrow(ConversionError);
    });
  });

  describe('DefaultFilterSelector', () => {
    it('should return null for unsupported conversions', () => {
      const selector = new DefaultFilterSelector();
      expect(selector.getFilterPath('html', 'markdown')).toBeNull();
    });

    it('should return filter path for markdown to redmine-textile', () => {
      const selector = new DefaultFilterSelector();
      const result = selector.getFilterPath('markdown', 'redmine-textile');
      expect(typeof result).toBe('string');
      expect(result).toContain('ToRedmine.js');
    });
  });
});