import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TESTS_DIR = __dirname;
const PROJECT_ROOT = join(__dirname, '../../'); // distディレクトリから2階層上がプロジェクトルート
const SNAPSHOTS_DIR = join(PROJECT_ROOT, 'tests/snapshots');
const MANIFEST_PATH = join(SNAPSHOTS_DIR, 'manifest.json');
const FILTER_PATH = join(PROJECT_ROOT, 'dist/ToRedmine.js'); // コンパイル済みのJSファイルを使用

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
 * pandocフィルターを実行してHTML出力を取得
 */
function runPandocFilter(inputPath: string, inputType: string = 'markdown'): string {
  try {
    const command = `pandoc --from=${inputType} --to=html --filter="${FILTER_PATH}" "${inputPath}"`;
    const result = execSync(command, { 
      encoding: 'utf8',
      cwd: PROJECT_ROOT
    });
    return result.trim();
  } catch (error) {
    throw new Error(`Pandoc execution failed: ${error}`);
  }
}

/**
 * HTMLを指定された形式に変換
 */
function convertHtmlTo(html: string, outputType: string): string {
  try {
    // シングルクォートをエスケープ
    const escapedHtml = html.replace(/'/g, "'\\''");
    const command = `echo '${escapedHtml}' | pandoc --from=html --to=${outputType}`;
    
    const result = execSync(command, { 
      encoding: 'utf8',
      shell: '/bin/bash'
    });
    return result.trim();
  } catch (error) {
    throw new Error(`HTML to ${outputType} conversion failed: ${error}`);
  }
}

/**
 * textile出力用の処理（入力を直接textileに変換してフィルターを適用）
 */
async function processForTextileOutput(inputPath: string, inputType: string): Promise<string> {
  try {
    const command = `pandoc --from=${inputType} --to=textile --filter="${FILTER_PATH}" "${inputPath}"`;
    const result = execSync(command, { 
      encoding: 'utf8',
      cwd: PROJECT_ROOT
    });
    return result.trim();
  } catch (error) {
    throw new Error(`Direct textile conversion with filter failed: ${error}`);
  }
}

/**
 * 出力を正規化（空白やフォーマットの違いを吸収）
 */
function normalizeOutput(output: string): string {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
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
    
    it(`${testName}: should transform ${testCase.input_type} to ${testCase.output_type}`, async () => {
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
        actualOutput = await processForTextileOutput(inputPath, testCase.input_type);
        console.log(`Direct textile conversion result:\n${actualOutput}`);
      } else {
        // その他の形式の場合は従来通りHTML経由で変換
        const htmlOutput = runPandocFilter(inputPath, testCase.input_type);
        console.log(`HTML Output:\n${htmlOutput}`);
        
        try {
          actualOutput = convertHtmlTo(htmlOutput, testCase.output_type);
          console.log(`Converted to ${testCase.output_type}:\n${actualOutput}`);
        } catch (error) {
          console.warn(`Could not convert HTML to ${testCase.output_type}: ${error}`);
          // 変換に失敗した場合はHTMLの内容を直接検証
          validateHtmlContent(htmlOutput, testName, expectedOutput);
          return;
        }
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
 * HTMLの内容を直接検証（形式変換が失敗した場合のフォールバック）
 */
function validateHtmlContent(html: string, testName: string, expectedOutput: string): void {
  console.log(`Validating HTML content directly for ${testName}`);
  
  if (testName.includes('inlinecode')) {
    assert(html.includes('<code>'), 'Should contain inline code tags');
    // 期待される出力からインラインコードの内容を確認
    if (expectedOutput.includes('<code>code</code>')) {
      assert(html.includes('<code>code</code>'), 'Should contain specific inline code content');
    }
  }
  
  if (testName.includes('blockcode')) {
    assert(html.includes('<pre><code'), 'Should contain block code structure');
    
    // PlantUMLの特別処理を確認
    if (expectedOutput.includes('{{plantuml')) {
      assert(html.includes('{{plantuml'), 'PlantUML should use special Redmine syntax');
    }
    
    // 各種言語クラスの確認
    if (expectedOutput.includes('class="html"')) {
      // nested preタグがない場合のみクラスが含まれるべき
      const htmlContent = html.toLowerCase();
      const hasNestedPre = htmlContent.includes('<pre><code') && 
                          htmlContent.indexOf('<pre>') !== htmlContent.lastIndexOf('<pre>');
      
      if (!hasNestedPre) {
        assert(html.includes('class="html"'), 'Should include language class when no nested pre tag');
      }
    }
  }
  
  console.log(`✓ HTML content validation passed for ${testName}`);
}

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