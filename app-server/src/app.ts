import express, { type Express } from 'express';
import path from 'path';
import { ConversionController } from './controllers/ConversionController';
import { errorHandler } from './middleware/errorHandler';
import { PandocSocketClient } from './types';

/** createApp に注入する依存 */
export interface AppDependencies {
  pandocClient: PandocSocketClient;
  /** web-simple の静的ファイルを置いたディレクトリの絶対パス */
  webAppPath: string;
}

/** Express の既定（case sensitive routing 無効）に合わせ、大文字小文字を区別せずに /api 配下か判定する */
function isApiPath(requestPath: string): boolean {
  const lower = requestPath.toLowerCase();
  return lower === '/api' || lower.startsWith('/api/');
}

/** ルーティング・ミドルウェアを組み立てた Express アプリを返す。listen はしない */
export function createApp(deps: AppDependencies): Express {
  // pnpm 移行時の不具合: declaration: true の下で app の型を推論させると、
  // pnpm の node_modules 配置では推論型が参照する @types/express-serve-static-core を
  // app-server から直接解決できず TS2742 でビルドが失敗する。
  // express が再エクスポートする Express 型を明示して解決する。
  const app: Express = express();
  const { webAppPath } = deps;
  const indexHtmlPath = path.join(webAppPath, 'index.html');

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static files for web application
  app.use(express.static(webAppPath));

  // API Routes
  const conversionController = new ConversionController(deps.pandocClient);
  app.post(
    '/api/v1/sync/convert',
    conversionController.convertSync.bind(conversionController)
  );

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Web application route
  app.get('/', (req, res) => {
    res.sendFile(indexHtmlPath);
  });

  // Catch-all for web app routes (SPA support)
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (isApiPath(req.path)) {
      return next();
    }
    res.sendFile(indexHtmlPath);
  });

  // 404 handler for API routes only
  // バグ修正: 以前は app.use('/api/*', ...) 内で req.path を使っていたが、mount 配下の req.path は
  // mount パスを除いた残りで、'/api/*' では常に '/' になるため message が常に 'API route GET / not found' だった。
  // また '/api' 自体は一致せず、GET は index.html、POST は Express 既定の HTML 404 になっていた。
  // '/api' に mount し（'/api' 自体にも一致する）、mount に影響されない originalUrl のパス部分を使う
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `API route ${req.method} ${req.originalUrl.split('?')[0]} not found`,
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
