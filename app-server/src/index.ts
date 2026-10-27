import { createServer } from 'http';
import { createApp } from './app';
import { parseArgs } from './config';
import { PandocSocketClientImpl } from './services/PandocSocketClientImpl';
import { installShutdownHandlers } from './shutdown';

/**
 * メイン実行関数。引数解析・組み立て・待ち受けを行う。process.exit はこの関数でのみ呼ぶ
 *
 * 以前は import するだけで process.argv を解析し、テストランナーの引数次第で process.exit していたため、
 * 解析は config.ts の parseArgs（純粋関数）、ルーティングは app.ts の createApp に分離した
 */
function main(): void {
  const parsed = parseArgs(process.argv.slice(2), process.env);
  if (parsed.kind === 'help') {
    console.log(parsed.text);
    process.exit(0);
  }
  if (parsed.kind === 'error') {
    console.error(`Error: ${parsed.message}`);
    console.error('Use --help for usage information');
    process.exit(1);
  }
  const { config } = parsed;

  // composition root: 具象クラスの組み立てはここだけで行う
  const app = createApp({
    pandocClient: new PandocSocketClientImpl(config.socketPath),
    webAppPath: config.webAppPath,
  });
  const server = createServer(app);

  // 以前は 'error' を処理しておらず、EADDRINUSE 等で未処理例外として異常終了していた
  server.on('error', (error) => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  });
  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Using pandoc-runner socket: ${config.socketPath}`);
  });
  installShutdownHandlers(process, server);
}

if (require.main === module) {
  main();
}

export { main };
