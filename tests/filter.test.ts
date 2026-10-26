import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// 注意: tests/snapshots/*.textile の期待値には、Redmine のタグ解釈を避けるためのゼロ幅スペース（U+200B）が意図的に含まれる
const PROJECT_ROOT = join(__dirname, '../../'); // distディレクトリから2階層上がプロジェクトルート
const SNAPSHOTS_DIR = join(PROJECT_ROOT, 'tests/snapshots');
const MANIFEST_PATH = join(SNAPSHOTS_DIR, 'manifest.json');
const FILTER_PATH = join(PROJECT_ROOT, 'dist/src/ToRedmine.js');

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
  });
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
 * textile 出力を正規化する。各行の末尾空白と末尾の改行のみを除去する
 * 問題: 以前は全形式で各行の trim と空行除去を行っていたため、コードブロック内のインデント変更・空行の増減を検出できなかった
 * 解決: textile はコードブロック本文をそのまま出力するため、行頭の空白と空行は比較対象として残す
 * 制限: 行末の空白はエディタ等で失われやすいため除去しており、コード行末尾の空白の変化は検証対象外
 */
function normalizeTextileOutput(output: string): string {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');
}

/**
 * textile 以外の出力を正規化（HTML 経由の変換で生じる空白やフォーマットの違いを吸収）
 */
function normalizeLooseOutput(output: string): string {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
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

  for (const testCase of testCases) {
    const testName = testCase.input.replace(/\.[^.]+$/, '');

    it(`${testName}: should transform ${testCase.input_type} to ${testCase.output_type}`, () => {
      console.log(`\n=== Testing: ${testName} ===`);

      const inputPath = join(SNAPSHOTS_DIR, testCase.input);
      const outputPath = join(SNAPSHOTS_DIR, testCase.output);

      const inputContent = readFileSync(inputPath, 'utf8');
      console.log(`Input (${testCase.input}):\n${inputContent}`);

      const expectedOutput = readFileSync(outputPath, 'utf8');
      console.log(`Expected (${testCase.output}):\n${expectedOutput}`);

      let actualOutput: string;

      if (testCase.output_type === 'textile') {
        actualOutput = processForTextileOutput(
          inputContent,
          testCase.input_type
        );
        console.log(`Direct textile conversion result:\n${actualOutput}`);
      } else {
        // その他の形式は HTML 経由で変換する
        const htmlOutput = runPandocFilter(inputContent, testCase.input_type);
        console.log(`HTML Output:\n${htmlOutput}`);
        actualOutput = convertHtmlTo(htmlOutput, testCase.output_type);
        console.log(`Converted to ${testCase.output_type}:\n${actualOutput}`);
      }

      const normalize =
        testCase.output_type === 'textile'
          ? normalizeTextileOutput
          : normalizeLooseOutput;
      const normalizedActual = normalize(actualOutput);
      const normalizedExpected = normalize(expectedOutput);

      if (normalizedActual !== normalizedExpected) {
        console.log(`\n=== MISMATCH in ${testName} ===`);
        console.log(`Actual (normalized):\n${normalizedActual}`);
        console.log(`Expected (normalized):\n${normalizedExpected}`);
        console.log(`=== END MISMATCH ===\n`);

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
    // 空行と欠落行を区別するため、falsy 判定ではなく行数で判定する
    const actualLine = i < actualLines.length ? actualLines[i] : '<missing>';
    const expectedLine =
      i < expectedLines.length ? expectedLines[i] : '<missing>';

    if (actualLine !== expectedLine) {
      console.log(`Line ${i + 1}:`);
      console.log(`  Actual  : "${actualLine}"`);
      console.log(`  Expected: "${expectedLine}"`);
    }
  }
  console.log('--- End Diff ---\n');
}
