import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// 注意: tests/snapshots/*.textile の期待値には、Redmine のタグ解釈を避けるためのゼロ幅スペース（U+200B）が意図的に含まれる
const TESTS_DIR = __dirname;
const PROJECT_ROOT = join(__dirname, '../../'); // distディレクトリから2階層上がプロジェクトルート
const SNAPSHOTS_DIR = join(PROJECT_ROOT, 'tests/snapshots');
const MANIFEST_PATH = join(SNAPSHOTS_DIR, 'manifest.json');
const FILTER_PATH = join(PROJECT_ROOT, 'dist/src/ToRedmine.js'); // コンパイル済みのJSファイルを使用

interface TestCase {
  input: string;
  output: string;
  input_type: string;
  output_type: string;
}

/**
 * manifest.jsonからテストケースを読み込み
 */
function loadTestCases(): TestCase[] {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest file not found: ${MANIFEST_PATH}`);
  }

  const manifestContent = readFileSync(MANIFEST_PATH, 'utf8');
  const testCases: TestCase[] = JSON.parse(manifestContent);

  // ファイルの存在チェック
  for (const testCase of testCases) {
    const inputPath = join(SNAPSHOTS_DIR, testCase.input);
    const outputPath = join(SNAPSHOTS_DIR, testCase.output);

    if (!existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    if (!existsSync(outputPath)) {
      throw new Error(`Output file not found: ${outputPath}`);
    }
  }

  return testCases;
}

/**
 * pandoc をシェルを経由せずに起動し、標準出力を返す。失敗時は例外となりテストが失敗する
 * @param args pandoc に渡す引数
 * @param input 標準入力に与える文字列
 */
function runPandoc(args: string[], input: string): string {
  return execFileSync('pandoc', args, {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    input,
  }).trim();
}

/**
 * pandocフィルターを実行してHTML出力を取得
 */
function runPandocFilter(inputContent: string, inputType: string): string {
  return runPandoc(
    [`--from=${inputType}`, '--to=html', '--filter', FILTER_PATH],
    inputContent
  );
}

/**
 * HTMLを指定された形式に変換
 */
function convertHtmlTo(html: string, outputType: string): string {
  return runPandoc(['--from=html', `--to=${outputType}`], html);
}

/**
 * textile出力用の処理（入力を直接textileに変換してフィルターを適用）
 * pandoc-runner（pandoc-runner/src/PandocConverter.ts）と同じく、引数 `-f <type> -t textile --filter <path>` で
 * 標準入力から変換する
 */
function processForTextileOutput(
  inputContent: string,
  inputType: string
): string {
  return runPandoc(
    ['-f', inputType, '-t', 'textile', '--filter', FILTER_PATH],
    inputContent
  );
}

/**
 * 出力を正規化（空白やフォーマットの違いを吸収）
 */
function normalizeOutput(output: string): string {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/**
 * テストケース名を生成
 */
function getTestName(testCase: TestCase): string {
  const baseName = testCase.input.replace(/\.[^.]+$/, ''); // 拡張子を除去
  return baseName;
}

describe('Pandoc Filter Snapshot Tests', () => {
  let testCases: TestCase[];

  try {
    testCases = loadTestCases();
  } catch (error) {
    it('should load manifest file', () => {
      assert.fail(`Failed to load test cases: ${error}`);
    });
    return;
  }

  if (testCases.length === 0) {
    it('should have test cases in manifest', () => {
      assert.fail('No test cases found in manifest.json');
    });
    return;
  }

  // 各テストケースごとに独立したテストを生成
  for (const testCase of testCases) {
    const testName = getTestName(testCase);

    it(`${testName}: should transform ${testCase.input_type} to ${testCase.output_type}`, () => {
      console.log(`\n=== Testing: ${testName} ===`);

      const inputPath = join(SNAPSHOTS_DIR, testCase.input);
      const outputPath = join(SNAPSHOTS_DIR, testCase.output);

      // 入力ファイルを読み込み
      const inputContent = readFileSync(inputPath, 'utf8');
      console.log(`Input (${testCase.input}):\n${inputContent}`);

      // 期待される結果を読み込み
      const expectedOutput = readFileSync(outputPath, 'utf8').trim();
      console.log(`Expected (${testCase.output}):\n${expectedOutput}`);

      let actualOutput: string;

      if (testCase.output_type === 'textile') {
        // textileの場合は入力を直接textileに変換してフィルターを適用
        actualOutput = processForTextileOutput(
          inputContent,
          testCase.input_type
        );
        console.log(`Direct textile conversion result:\n${actualOutput}`);
      } else {
        // その他の形式の場合は従来通りHTML経由で変換。変換失敗時はフォールバックせずテストを失敗させる
        const htmlOutput = runPandocFilter(inputContent, testCase.input_type);
        console.log(`HTML Output:\n${htmlOutput}`);
        actualOutput = convertHtmlTo(htmlOutput, testCase.output_type);
        console.log(`Converted to ${testCase.output_type}:\n${actualOutput}`);
      }

      // 正規化して比較
      const normalizedActual = normalizeOutput(actualOutput);
      const normalizedExpected = normalizeOutput(expectedOutput);

      if (normalizedActual !== normalizedExpected) {
        console.log(`\n=== MISMATCH in ${testName} ===`);
        console.log(`Actual (normalized):\n${normalizedActual}`);
        console.log(`Expected (normalized):\n${normalizedExpected}`);
        console.log(`=== END MISMATCH ===\n`);

        // 詳細な差分を表示
        showDetailedDiff(normalizedActual, normalizedExpected);
      }

      assert.strictEqual(
        normalizedActual,
        normalizedExpected,
        `Snapshot mismatch for ${testName} (${testCase.input} -> ${testCase.output})`
      );

      console.log(`✓ ${testName} test passed`);
    });
  }
});

/**
 * 詳細な差分を表示
 */
function showDetailedDiff(actual: string, expected: string): void {
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');

  console.log('\n--- Detailed Diff ---');
  const maxLines = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const actualLine = actualLines[i] || '<missing>';
    const expectedLine = expectedLines[i] || '<missing>';

    if (actualLine !== expectedLine) {
      console.log(`Line ${i + 1}:`);
      console.log(`  Actual  : "${actualLine}"`);
      console.log(`  Expected: "${expectedLine}"`);
    }
  }
  console.log('--- End Diff ---\n');
}
