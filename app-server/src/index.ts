import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { ConversionController } from './controllers/ConversionController';
import { PandocSocketClientImpl } from './services/PandocSocketClientImpl';

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    port: process.env.PORT || 3000,
    socketPath: '/tmp/pandoc-runner.sock' // default
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--pandoc-socket-path') {
      const socketPath = args[i + 1];
      if (socketPath && !socketPath.startsWith('-')) {
        config.socketPath = socketPath;
        i++; // Skip next argument as it's the socket path
      } else {
        console.error('Error: --pandoc-socket-path requires a path argument');
        process.exit(1);
      }
    } else if (arg === '--port' || arg === '-p') {
      const port = args[i + 1];
      if (port && !port.startsWith('-')) {
        config.port = parseInt(port, 10);
        if (isNaN(config.port)) {
          console.error('Error: --port requires a numeric argument');
          process.exit(1);
        }
        i++; // Skip next argument as it's the port
      } else {
        console.error('Error: --port requires a numeric argument');
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node dist/index.js [options]

Options:
  --pandoc-socket-path <path>  Unix socket path for pandoc-runner (default: /tmp/pandoc-runner.sock)
  -p, --port <number>          Port number for HTTP server (default: 3000)
  -h, --help                   Show this help message

Examples:
  node dist/index.js --pandoc-socket-path /tmp/custom-pandoc.sock --port 8080
  node dist/index.js --pandoc-socket-path /var/run/pandoc.sock -p 3001
      `);
      process.exit(0);
    } else if (arg.startsWith('-')) {
      console.error(`Error: Unknown option '${arg}'`);
      console.error('Use --help for usage information');
      process.exit(1);
    }
  }

  return config;
}

const config = parseArguments();
const app = express();
const port = config.port;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for web application
const webAppPath = path.join(__dirname, '../web-simple');
app.use(express.static(webAppPath));

// Services
const pandocClient = new PandocSocketClientImpl(config.socketPath);
const conversionController = new ConversionController(pandocClient);

// API Routes
app.post('/api/v1/sync/convert', conversionController.convertSync.bind(conversionController));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Web application route
app.get('/', (req, res) => {
  res.sendFile(path.join(webAppPath, 'index.html'));
});

// Catch-all for web app routes (SPA support)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(webAppPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API route ${req.method} ${req.path} not found`
  });
});

const server = createServer(app);

// Only start server if this file is run directly
if (require.main === module) {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Using pandoc-runner socket: ${config.socketPath}`);
  });
}

export { app, server };