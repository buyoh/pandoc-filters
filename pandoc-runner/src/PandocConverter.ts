import { CommandExecutor, FilterSelector, ConversionError } from './types';
import { DefaultCommandExecutor } from './CommandExecutor';

/**
 * デフォルトのフィルターセレクター
 */
export class DefaultFilterSelector implements FilterSelector {
  /**
   * フィルターパスを取得する
   * @param fromFormat 変換元フォーマット
   * @param toFormat 変換先フォーマット
   * @returns フィルターパス（なければnull）
   */
  getFilterPath(fromFormat: string, toFormat: string): string | null {
    if (fromFormat === 'markdown' && toFormat === 'redmine-textile') {
      // TODO: adjust path as needed - use relative path from project root
      return '../dist/src/ToRedmine.js';
    }
    return null;
  }
}

/**
 * pandocコマンドを実行してmarkdownからredmine-textileに変換するクラス
 */
export class PandocConverter {
  private commandExecutor: CommandExecutor;
  private filterSelector: FilterSelector;

  constructor(
    commandExecutor: CommandExecutor = new DefaultCommandExecutor(),
    filterSelector: FilterSelector = new DefaultFilterSelector()
  ) {
    this.commandExecutor = commandExecutor;
    this.filterSelector = filterSelector;
  }

  /**
   * pandocコマンドが利用可能かチェック
   */
  async validatePandocAvailability(): Promise<void> {
    try {
      const result = await this.commandExecutor.execute('pandoc', ['--version']);
      if (result.exitCode !== 0) {
        throw new ConversionError('pandoc command not available');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new ConversionError('pandoc command not found');
      }
      throw new ConversionError('pandoc command not available');
    }
  }

  /**
   * markdownからredmine-textileに変換する
   * @param markdownText 変換元のmarkdownテキスト
   * @returns 変換後のredmine-textileテキスト
   */
  async convertMarkdownToRedmineTextile(markdownText: string): Promise<string> {
    if (typeof markdownText !== 'string') {
      throw new Error('markdown_text must be a string');
    }

    const filterPath = this.filterSelector.getFilterPath('markdown', 'redmine-textile');
    const commandArgs = ['pandoc', '-f', 'markdown', '-t', 'textile'];
    
    if (filterPath) {
      commandArgs.push('--filter', filterPath);
    }

    try {
      const result = await this.commandExecutor.execute(
        commandArgs[0],
        commandArgs.slice(1),
        { stdin: markdownText }
      );

      if (result.exitCode !== 0) {
        throw new ConversionError(`Pandoc conversion failed: ${result.stderr}`);
      }

      return result.stdout;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new ConversionError('pandoc command not found');
      }
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ConversionError(`Conversion failed: ${error}`);
    }
  }
}
