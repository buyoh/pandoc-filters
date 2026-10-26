import * as path from 'path';

/**
 * 環境変数から解決した runner の実行時設定。
 * パスの解決はこのモジュールに一元化し、他のモジュールは環境変数・cwd を参照しない。
 */
export interface RunnerConfig {
  /** pandoc 実行ファイルのパス（PF_PANDOC_PATH。未設定なら PATH 上の `pandoc`） */
  pandocPath: string;
  /**
   * pandoc に `--filter` で渡す ToRedmine フィルタの絶対パス（PF_FILTER_PATH。未設定ならリポジトリの dist）。
   * PF_FILTER_PATH が相対パスの場合は起動時のカレントディレクトリ基準で絶対パス化する
   */
  filterPath: string;
}

/** --socket 省略時のソケットパス */
export const DEFAULT_SOCKET_PATH = '/tmp/pandoc-runner.sock';

/**
 * 既定のフィルタパス。src/ からの実行（tsx）でも dist/ からの実行（node）でも
 * `pandoc-runner/<dir>/` の 2 階層上がリポジトリルートになる
 */
export const DEFAULT_FILTER_PATH = path.resolve(
  __dirname,
  '../../dist/src/ToRedmine.js'
);

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * 環境変数から設定を解決する
 * @param env 参照する環境変数（通常は process.env）
 */
export function resolveRunnerConfig(env: NodeJS.ProcessEnv): RunnerConfig {
  // バグ修正: 以前はフィルタパスを PandocRunnerServer（__dirname 相対）と
  // PandocConverter（cwd 相対の '../dist/src/ToRedmine.js'）の 2 箇所で別々に決めており、
  // 後者は起動ディレクトリに依存していた。ここで絶対パスに一元化し、環境変数で上書き可能にする
  const filterPath = nonEmpty(env.PF_FILTER_PATH);
  return {
    pandocPath: nonEmpty(env.PF_PANDOC_PATH) ?? 'pandoc',
    filterPath:
      filterPath !== undefined ? path.resolve(filterPath) : DEFAULT_FILTER_PATH,
  };
}

/** 設定値の検証結果。ファイルが無い等の想定される失敗は戻り値で返す */
export type RunnerConfigValidation =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 設定値が指すファイルを検証する。フィルタが無いと全リクエストが変換失敗になるため、起動時に検知する
 * @param config 検証する設定
 * @param isFile パスが通常ファイルとして存在するか判定する関数（テストではスタブを渡す）
 */
export function validateRunnerConfig(
  config: RunnerConfig,
  isFile: (filePath: string) => boolean
): RunnerConfigValidation {
  if (!isFile(config.filterPath)) {
    return { ok: false, message: `filter not found: ${config.filterPath}` };
  }
  return { ok: true };
}
