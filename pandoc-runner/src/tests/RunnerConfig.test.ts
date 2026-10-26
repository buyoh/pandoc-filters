import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { resolveRunnerConfig, validateRunnerConfig } from '../RunnerConfig';

describe('resolveRunnerConfig', () => {
  it('defaults to pandoc on PATH and the filter built at the repository root', () => {
    // 以前は cwd 相対の '../dist/src/ToRedmine.js' が使われ得たため、起動ディレクトリに依存しない絶対パスであることを確認する
    const repoRoot = path.resolve(__dirname, '../../..');
    assert.deepStrictEqual(resolveRunnerConfig({}), {
      pandocPath: 'pandoc',
      filterPath: path.join(repoRoot, 'dist/src/ToRedmine.js'),
    });
  });

  it('uses PF_PANDOC_PATH and PF_FILTER_PATH when set', () => {
    const config = resolveRunnerConfig({ PF_PANDOC_PATH: '/opt/pandoc/bin/pandoc', PF_FILTER_PATH: '/opt/filter.js' });
    assert.deepStrictEqual(config, { pandocPath: '/opt/pandoc/bin/pandoc', filterPath: '/opt/filter.js' });
  });

  it('treats empty environment variables as unset', () => {
    const config = resolveRunnerConfig({ PF_PANDOC_PATH: '', PF_FILTER_PATH: '' });
    assert.strictEqual(config.pandocPath, 'pandoc');
    assert.ok(path.isAbsolute(config.filterPath));
  });

  it('resolves a relative PF_FILTER_PATH against the working directory', () => {
    const config = resolveRunnerConfig({ PF_FILTER_PATH: 'build/filter.js' });
    assert.strictEqual(config.filterPath, path.resolve(process.cwd(), 'build/filter.js'));
  });
});

describe('validateRunnerConfig', () => {
  const config = { pandocPath: 'pandoc', filterPath: '/opt/filter.js' };

  it('succeeds when the filter file exists', () => {
    assert.deepStrictEqual(validateRunnerConfig(config, (filePath) => filePath === '/opt/filter.js'), { ok: true });
  });

  it('fails when the filter file does not exist', () => {
    const validation = validateRunnerConfig(config, () => false);
    assert.deepStrictEqual(validation, { ok: false, message: 'filter not found: /opt/filter.js' });
  });
});
