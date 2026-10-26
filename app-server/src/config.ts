import path from 'path';

/**
 * コマンドライン引数・環境変数から解決した app-server の実行時設定。
 * パス・既定値の解決はこのモジュールに一元化し、他のモジュールは process.argv / process.env / __dirname を参照しない
 */
export interface AppConfig {
  /** HTTP サーバの待ち受けポート番号（1〜65535 の整数） */
  port: number;
  /** pandoc-runner の Unix ソケットパス */
  socketPath: string;
  /** web-simple の静的ファイルを置いたディレクトリの絶対パス（現状は引数で変更できず、常に DEFAULT_WEB_APP_PATH） */
  webAppPath: string;
}

export const DEFAULT_PORT = 3000;
export const DEFAULT_SOCKET_PATH = '/tmp/pandoc-runner.sock';
/** 既定の web-simple ディレクトリ。src/ からの実行（tsx）でも dist/ からの実行（node）でも app-server/web-simple になる */
export const DEFAULT_WEB_APP_PATH = path.resolve(__dirname, '../web-simple');

export const HELP_TEXT = `
Usage: node dist/index.js [options]

Options:
  --pandoc-socket-path <path>  Unix socket path for pandoc-runner (default: ${DEFAULT_SOCKET_PATH})
  -p, --port <number>          Port number for HTTP server (default: PORT environment variable or ${DEFAULT_PORT})
  -h, --help                   Show this help message

Examples:
  node dist/index.js --pandoc-socket-path /tmp/custom-pandoc.sock --port 8080
  node dist/index.js --pandoc-socket-path /var/run/pandoc.sock -p 3001
`;

/** parseArgs の結果。不正な引数・--help は例外ではなく戻り値で返す */
export type ParseArgsResult =
  | { kind: 'ok'; config: AppConfig }
  | { kind: 'help'; text: string } // --help 指定時。text は表示する使い方
  | { kind: 'error'; message: string }; // 不正な引数・環境変数。message は利用者向けの説明

const MAX_PORT = 65535;

/** ポート番号の文字列を検証する。10 進数字のみ・1〜65535 の場合に数値を返し、それ以外は undefined */
export function parsePort(value: string): number | undefined {
  // parseInt は '80abc' を 80 として受理するため使わない
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  const port = Number(value);
  return port >= 1 && port <= MAX_PORT ? port : undefined;
}

/** オプションの値を取り出す。値が無い・次のオプションが続く場合は undefined */
function optionValue(
  args: readonly string[],
  index: number
): string | undefined {
  const value = args[index + 1];
  return value !== undefined && value.length > 0 && !value.startsWith('-')
    ? value
    : undefined;
}

/**
 * コマンドライン引数と環境変数から設定を解決する。先頭から順に解釈し、最初に見つかった error / help を返す
 * @param args コマンドライン引数（process.argv.slice(2) 相当。node / スクリプトのパスは含まない）
 * @param env 参照する環境変数（通常は process.env）。PORT のみ参照する
 */
export function parseArgs(
  args: readonly string[],
  env: NodeJS.ProcessEnv
): ParseArgsResult {
  let socketPath = DEFAULT_SOCKET_PATH;
  let port: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--pandoc-socket-path') {
      const value = optionValue(args, i);
      if (value === undefined) {
        return {
          kind: 'error',
          message: '--pandoc-socket-path requires a path argument',
        };
      }
      socketPath = value;
      i++;
    } else if (arg === '--port' || arg === '-p') {
      const value = optionValue(args, i);
      port = value !== undefined ? parsePort(value) : undefined;
      if (port === undefined) {
        return {
          kind: 'error',
          message: `--port requires an integer between 1 and ${MAX_PORT}`,
        };
      }
      i++;
    } else if (arg === '--help' || arg === '-h') {
      return { kind: 'help', text: HELP_TEXT };
    } else if (arg.startsWith('-')) {
      return { kind: 'error', message: `Unknown option '${arg}'` };
    }
    // 位置引数は無視する
  }

  // --port が指定されていれば PORT は使わないため検証もしない（上書きされる値で起動を止めない）
  if (port === undefined) {
    const envPort = env.PORT;
    if (envPort === undefined || envPort.length === 0) {
      port = DEFAULT_PORT;
    } else {
      port = parsePort(envPort);
      if (port === undefined) {
        return {
          kind: 'error',
          message: `PORT environment variable must be an integer between 1 and ${MAX_PORT}`,
        };
      }
    }
  }

  return {
    kind: 'ok',
    config: { port, socketPath, webAppPath: DEFAULT_WEB_APP_PATH },
  };
}
