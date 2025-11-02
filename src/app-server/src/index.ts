import express from 'express';
import { createServer } from 'http';
import { ConversionController } from './controllers/ConversionController';
import { PandocSocketClient } from './services/PandocSocketClient';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Services
const pandocClient = new PandocSocketClient();
const conversionController = new ConversionController(pandocClient);

// API Routes
app.post('/api/v1/sync/convert', conversionController.convertSync.bind(conversionController));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

const server = createServer(app);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export { app, server };