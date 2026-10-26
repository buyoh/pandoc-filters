import * as fs from 'fs';
import { program } from 'commander';
import { PandocRunnerServer } from './PandocRunnerServer';
import { PandocConverter, DefaultFilterSelector } from './PandocConverter';
import { DefaultCommandExecutor } from './CommandExecutor';
import { RequestHandler } from './RequestHandler';
import { UnixSocketServer } from './UnixSocketServer';
import { DefaultLogger } from './Logger';
import { DEFAULT_SOCKET_PATH, resolveRunnerConfig, validateRunnerConfig } from './RunnerConfig';
import { installSignalHandlers } from './SignalHandlers';
import { ConversionError } from './types';

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  program
    .name('pandoc-runner')
    .description('TypeScript pandoc server with Unix socket communication')
    .version('1.0.0')
    .option('-s, --socket <path>', 'Unix socket path', DEFAULT_SOCKET_PATH)
    .option('-v, --verbose', 'Verbose logging')
    .option('-q, --quiet', 'Quiet logging')
    .parse();

  const options = program.opts();

  let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  if (options.verbose) {
    logLevel = 'debug';
  } else if (options.quiet) {
    logLevel = 'warn';
  }

  const logger = new DefaultLogger(logLevel);
  const config = resolveRunnerConfig(process.env);

  const validation = validateRunnerConfig(config, (filePath) => {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  });
  if (!validation.ok) {
    console.error(`Error: ${validation.message}`);
    console.error('Build the filter (pnpm build at the repository root) or set PF_FILTER_PATH');
    process.exit(1);
  }

  // composition root: 具象クラスの組み立てはここだけで行う
  const converter = new PandocConverter(
    new DefaultCommandExecutor(),
    new DefaultFilterSelector(config.filterPath),
    config.pandocPath
  );
  const server = new PandocRunnerServer({
    pandocValidator: converter,
    requestHandler: new RequestHandler(converter),
    socketServer: new UnixSocketServer(options.socket, logger),
    logger,
  });

  try {
    await server.start();
  } catch (error) {
    if (error instanceof ConversionError) {
      console.error(`Error: ${error.message}`);
      console.error('Please make sure pandoc is installed and available in PATH (or set PF_PANDOC_PATH)');
    } else {
      console.error(`Unexpected error: ${error}`);
    }
    process.exit(1);
  }

  installSignalHandlers(process, server, logger);
}

// メイン関数を実行（モジュールとして直接実行された場合のみ）
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { main };
export * from './types';
export * from './PandocRunnerServer';
export * from './PandocConverter';
export * from './RequestHandler';
export * from './UnixSocketServer';
export * from './CommandExecutor';
export * from './Logger';
export * from './RunnerConfig';
export * from './SignalHandlers';