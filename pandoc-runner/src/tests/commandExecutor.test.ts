import { describe, it, beforeEach } from 'node:test';import { DefaultCommandExecutor } from '../src/commandExecutor';

import assert from 'node:assert';

import { DefaultCommandExecutor } from '../commandExecutor';describe('DefaultCommandExecutor', () => {

  let executor: DefaultCommandExecutor;

describe('DefaultCommandExecutor', () => {

  let executor: DefaultCommandExecutor;  beforeEach(() => {

    executor = new DefaultCommandExecutor();

  beforeEach(() => {  });

    executor = new DefaultCommandExecutor();

  });  describe('execute', () => {

    it('should execute a simple command successfully', async () => {

  describe('execute', () => {      const result = await executor.execute('echo', ['hello']);

    it('should execute a simple command successfully', async () => {      

      const result = await executor.execute('node', ['--version']);      expect(result.exitCode).toBe(0);

            expect(result.stdout).toBe('hello');

      assert.strictEqual(result.exitCode, 0);      expect(result.stderr).toBe('');

      assert(typeof result.stdout === 'string');    });

      assert(result.stdout.includes('v'));

      assert.strictEqual(result.stderr, '');    it('should handle command with stdin', async () => {

    });      const result = await executor.execute('cat', [], { stdin: 'test input' });

      

    it('should handle command with stdin', async () => {      expect(result.exitCode).toBe(0);

      const result = await executor.execute('node', ['-e', 'process.stdin.pipe(process.stdout)'], { stdin: 'test input' });      expect(result.stdout).toBe('test input');

          });

      assert.strictEqual(result.exitCode, 0);

      assert.strictEqual(result.stdout, 'test input');    it('should handle command errors', async () => {

    });      await expect(executor.execute('nonexistent-command'))

        .rejects.toThrow();

    it('should handle command errors', async () => {    });

      try {

        await executor.execute('nonexistent-command');    it('should capture stderr', async () => {

        assert.fail('Should have thrown an error');      // Use a command that writes to stderr - this might be platform specific

      } catch (error) {      const result = await executor.execute('node', ['-e', 'console.error("error message")']);

        assert(error instanceof Error);      

      }      expect(result.exitCode).toBe(0);

    });      expect(result.stderr).toContain('error message');

    });

    it('should capture stderr', async () => {  });

      const result = await executor.execute('node', ['-e', 'console.error("error message")']);});
      
      assert.strictEqual(result.exitCode, 0);
      assert(result.stderr.includes('error message'));
    });
  });
});