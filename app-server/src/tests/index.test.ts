import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('index', () => {
  it('can be imported without parsing arguments, exiting or listening', async () => {
    // 以前は import した時点で process.argv を解析し、テストランナーの引数次第で process.exit していた。
    // 未知のオプションを足しておき、import 時に main が走れば必ず exit 1 で失敗させる
    // （引数なしだと listen が成功してハングするだけで失敗にならないため）。テストファイルごとに別プロセスなので他に影響しない
    process.argv.push('--index-test-unknown-option');
    const index = await import('../index');
    assert.strictEqual(typeof index.main, 'function');
  });
});
