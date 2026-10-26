import {
  CommandExecutor,
  CommandResult,
  FilterSelector,
  ConversionError,
  ConversionOutcome,
  MarkdownConverter,
  PandocAvailabilityValidator
} from './types';

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
}

/**
 * markdown → redmine-textile 変換に、指定した 1 つのフィルタを使うフィルターセレクター
 */
export class DefaultFilterSelector implements FilterSelector {
  /**
   * @param filterPath ToRedmine フィルタのパス（RunnerConfig.filterPath）
   */
  constructor(private filterPath: string) {}

  /**
   * フィルターパスを取得する
   * @param fromFormat 変換元フォーマット
   * @param toFormat 変換先フォーマット
   * @returns フィルターパス（なければnull）
   */
  getFilterPath(fromFormat: string, toFormat: string): string | null {
    if (fromFormat === 'markdown' && toFormat === 'redmine-textile') {
      return this.filterPath;
    }
    return null;
  }
}

/**
 * pandocコマンドを実行してmarkdownからredmine-textileに変換するクラス
 */
export class PandocConverter implements MarkdownConverter, PandocAvailabilityValidator {
  private commandExecutor: CommandExecutor;
  private filterSelector: FilterSelector;
  /** pandoc 実行ファイルのパス（RunnerConfig.pandocPath） */
  private pandocPath: string;

  constructor(
    commandExecutor: CommandExecutor,
    filterSelector: FilterSelector,
    pandocPath: string
  ) {
    this.commandExecutor = commandExecutor;
    this.filterSelector = filterSelector;
    this.pandocPath = pandocPath;
  }

  /**
   * pandocコマンドが利用可能かチェック
   */
  async validatePandocAvailability(): Promise<void> {
    try {
      const result = await this.commandExecutor.execute(this.pandocPath, ['--version']);
      if (result.exitCode !== 0) {
        throw new ConversionError('pandoc command not available');
      }
    } catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        throw new ConversionError('pandoc command not found');
      }
      throw new ConversionError('pandoc command not available');
    }
  }

  /**
   * markdownからredmine-textileに変換する。pandoc の失敗は戻り値で返す
   * @param markdownText 変換元のmarkdownテキスト
   */
  async convertMarkdownToRedmineTextile(markdownText: string): Promise<ConversionOutcome> {
    const filterPath = this.filterSelector.getFilterPath('markdown', 'redmine-textile');
    const commandArgs = ['-f', 'markdown', '-t', 'textile'];

    if (filterPath) {
      commandArgs.push('--filter', filterPath);
    }

    let result: CommandResult;
    try {
      result = await this.commandExecutor.execute(this.pandocPath, commandArgs, { stdin: markdownText });
    } catch (error) {
      // コマンドを起動できない（ENOENT 等）。execute の reject のみを変換失敗として扱う
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return { ok: false, message: 'pandoc command not found' };
      }
      return { ok: false, message: `Failed to run pandoc: ${error}` };
    }

    if (result.signal !== null) {
      return { ok: false, message: `Pandoc was terminated by signal ${result.signal}: ${result.stderr.trim()}` };
    }
    if (result.exitCode !== 0) {
      return { ok: false, message: `Pandoc conversion failed (exit code ${result.exitCode}): ${result.stderr.trim()}` };
    }

    // 以前は CommandExecutor が stdout 全体を trim() しており、先頭のインデント等が失われていた。
    // プロトコル仕様に従い、末尾の改行のみ除去する
    return { ok: true, output: result.stdout.replace(/(\r?\n)+$/, '') };
  }
}
