import { program } from 'commander';
import { PandocRunnerServer } from './PandocRunnerServer';
import { ConversionError } from './types';

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  program
    .name('pandoc-runner')
    .description('TypeScript pandoc server with Unix socket communication')
    .version('1.0.0')
    .option('-s, --socket <path>', 'Unix socket path', '/tmp/pandoc-runner.sock')
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

  try {
    const server = new PandocRunnerServer(options.socket, logLevel);
    await server.start();

    // サーバーが停止するまで待機
    process.on('SIGINT', () => {
      server.stop();
    });

    process.on('SIGTERM', () => {
      server.stop();
    });

  } catch (error) {
    if (error instanceof ConversionError) {
      console.error(`Error: ${error.message}`);
      console.error('Please make sure pandoc is installed and available in PATH');
      process.exit(1);
    } else {
      console.error(`Unexpected error: ${error}`);
      process.exit(1);
    }
  }
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