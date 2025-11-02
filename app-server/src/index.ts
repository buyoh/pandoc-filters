import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { ConversionController } from './controllers/ConversionController';
import { PandocSocketClientImpl } from './services/PandocSocketClientImpl';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for web application
const webAppPath = path.join(__dirname, '../web-simple');
app.use(express.static(webAppPath));

// Services
const pandocClient = new PandocSocketClientImpl();
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
  });
}

export { app, server };