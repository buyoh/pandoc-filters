import { Request, Response } from 'express';
import { PandocSocketClient } from '../services/PandocSocketClient';
import { ConversionRequest, ApiResponse } from '../types';

export class ConversionController {
  constructor(private pandocClient: PandocSocketClient) {}

  async convertSync(req: Request, res: Response): Promise<void> {
    try {
      const { input, from_format = 'markdown', to_format = 'redmine-textile' }: ConversionRequest = req.body;

      // Validation
      if (!input || typeof input !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid input: input field is required and must be a string',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      if (input.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid input: input cannot be empty',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      // Check if pandoc server is available
      const isAlive = await this.pandocClient.ping();
      if (!isAlive) {
        res.status(503).json({
          success: false,
          error: 'Pandoc server is not available',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      // Perform conversion
      const output = await this.pandocClient.convert(input, from_format, to_format);

      res.json({
        success: true,
        data: {
          output,
          from_format,
          to_format
        },
        timestamp: new Date().toISOString()
      } as ApiResponse);

    } catch (error) {
      console.error('Conversion error:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown conversion error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }
}