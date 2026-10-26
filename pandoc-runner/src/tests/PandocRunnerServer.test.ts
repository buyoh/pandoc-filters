import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PandocRunnerServer } from '../PandocRunnerServer';
import { ConversionError } from '../types';
import {
  EchoRequestHandler,
  SilentLogger,
  StubPandocValidator,
  StubSocketServer,
} from './stubs';

function createServer(
  validator: StubPandocValidator,
  socketServer: StubSocketServer
) {
  const requestHandler = new EchoRequestHandler();
  const server = new PandocRunnerServer({
    pandocValidator: validator,
    requestHandler,
    socketServer,
    logger: new SilentLogger(),
  });
  return { server, requestHandler };
}

describe('PandocRunnerServer', () => {
  it('starts the socket server with the request handler after pandoc is validated', async () => {
    const validator = new StubPandocValidator();
    const socketServer = new StubSocketServer();
    const { server, requestHandler } = createServer(validator, socketServer);

    await server.start();

    assert.strictEqual(validator.calls, 1);
    assert.strictEqual(server.isRunning(), true);
    assert.ok(socketServer.handler);
    assert.strictEqual(
      await socketServer.handler('{"action":"ping"}'),
      'echo:{"action":"ping"}'
    );
    assert.deepStrictEqual(requestHandler.received, ['{"action":"ping"}']);
  });

  it('does not start the socket server when pandoc is unavailable', async () => {
    const socketServer = new StubSocketServer();
    const { server } = createServer(
      new StubPandocValidator(new ConversionError('pandoc command not found')),
      socketServer
    );

    await assert.rejects(server.start(), ConversionError);

    assert.strictEqual(socketServer.handler, null);
    assert.strictEqual(server.isRunning(), false);
  });

  it('closes the socket server and is not running when the socket server fails to start', async () => {
    const socketServer = new StubSocketServer(new Error('EADDRINUSE'));
    const { server } = createServer(new StubPandocValidator(), socketServer);

    await assert.rejects(server.start(), /EADDRINUSE/);

    assert.strictEqual(socketServer.stopCalls, 1);
    assert.strictEqual(server.isRunning(), false);
  });

  it('stops the socket server only once', async () => {
    const socketServer = new StubSocketServer();
    const { server } = createServer(new StubPandocValidator(), socketServer);
    await server.start();

    await server.stop();
    await server.stop();

    assert.strictEqual(socketServer.stopCalls, 1);
    assert.strictEqual(server.isRunning(), false);
  });
});
