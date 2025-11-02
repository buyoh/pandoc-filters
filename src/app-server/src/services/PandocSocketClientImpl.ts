import { Socket } from 'net';
import { PandocRequest, PandocResponse, PandocSocketClient } from '../types';

export class PandocSocketClientImpl implements PandocSocketClient {
  private socketPath: string;

  constructor(socketPath: string = '/tmp/pandoc-runner.sock') {
    this.socketPath = socketPath;
  }

  async sendRequest(request: PandocRequest): Promise<PandocResponse> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let responseData = '';

      socket.on('connect', () => {
        const requestJson = JSON.stringify(request);
        socket.write(requestJson + '\n');
      });

      socket.on('data', (data) => {
        responseData += data.toString();
        
        // Check if we have a complete line (JSON response)
        if (responseData.includes('\n')) {
          const jsonLine = responseData.trim();
          try {
            const response: PandocResponse = JSON.parse(jsonLine);
            socket.end();
            resolve(response);
          } catch (error) {
            socket.end();
            reject(new Error(`Failed to parse response: ${error}`));
          }
        }
      });

      socket.on('error', (error) => {
        reject(new Error(`Socket error: ${error.message}`));
      });

      socket.on('close', () => {
        if (!responseData.includes('\n')) {
          reject(new Error('Socket closed without receiving complete response'));
        }
      });

      socket.connect(this.socketPath);
    });
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest({ action: 'ping' });
      return response.success;
    } catch (error) {
      console.error('Ping failed:', error);
      return false;
    }
  }

  async convert(input: string, fromFormat = 'markdown', toFormat = 'redmine-textile'): Promise<string> {
    const response = await this.sendRequest({
      action: 'convert',
      input,
      from_format: fromFormat,
      to_format: toFormat
    });

    if (!response.success) {
      throw new Error(response.error || 'Conversion failed');
    }

    return response.output || '';
  }
}