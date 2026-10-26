import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PandocConverter } from '../PandocConverter';
import { FilterSelector } from '../types';
import { StubCommandExecutor } from './stubs';

class NoFilterSelector implements FilterSelector {
  getFilterPath(): string | null {
    return null;
  }
}

function converterWith(executor: StubCommandExecutor): PandocConverter {
  return new PandocConverter(executor, new NoFilterSelector());
}

describe('PandocConverter outcome', () => {
  it('fails on non-zero exit code', async () => {
    const executor = new StubCommandExecutor({ result: { stdout: '', stderr: 'bad', exitCode: 1, signal: null } });
    const outcome = await converterWith(executor).convertMarkdownToRedmineTextile('# x');
    assert.strictEqual(outcome.ok, false);
  });

  it('fails when terminated by a signal', async () => {
    const executor = new StubCommandExecutor({
      result: { stdout: 'partial', stderr: '', exitCode: null, signal: 'SIGKILL' }
    });
    const outcome = await converterWith(executor).convertMarkdownToRedmineTextile('# x');
    assert.strictEqual(outcome.ok, false);
    assert.match(!outcome.ok ? outcome.message : '', /SIGKILL/);
  });

  it('fails when the command cannot be spawned', async () => {
    const error = Object.assign(new Error('spawn pandoc ENOENT'), { code: 'ENOENT' });
    const outcome = await converterWith(new StubCommandExecutor({ error })).convertMarkdownToRedmineTextile('# x');
    assert.deepStrictEqual(outcome, { ok: false, message: 'pandoc command not found' });
  });

  it('removes only trailing newlines and keeps leading whitespace', async () => {
    const executor = new StubCommandExecutor({
      result: { stdout: '  indented\n\nh1. title\n\n', stderr: '', exitCode: 0, signal: null }
    });
    const outcome = await converterWith(executor).convertMarkdownToRedmineTextile('# x');
    assert.deepStrictEqual(outcome, { ok: true, output: '  indented\n\nh1. title' });
  });
});
