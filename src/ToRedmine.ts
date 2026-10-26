import {
  RawBlock,
  RawInline,
  AnyElt,
  PandocMetaMap,
  toJSONFilter,
} from 'pandoc-filter';

//

/**
 * Redmine の textile パーサ（redcloth3.rb の OFFTAG_MATCH）がタグとして解釈する
 * `<code` `</code` `<pre` `</pre` `<kbd` `</kbd` `<notextile` `</notextile` の先頭の `<` にマッチする。
 * JS の `\b` は ASCII 基準で Ruby（Unicode 基準）より広くマッチするため、無害化の対象としては安全側になる
 */
const REDMINE_OFFTAG_PATTERN = /<(?=\/?(?:code|pre|kbd|notextile)\b)/gi;

const ZERO_WIDTH_SPACE = '\u200B';

/**
 * コード本文中の Redmine がタグとして解釈する文字列を無害化する
 *
 * Bug: コード中の `</code>` `</pre>` 等をそのまま埋め込んでいたため、Redmine がそこでコードを閉じ、
 * 以降が textile/HTML として解釈されて出力構造が壊れていた
 * Fix: Redmine は `<pre>` / `<code>` 内を自身で HTML エスケープする（`&` も `&amp;` になる）ため、
 * 実体参照でエスケープすると `&lt;` がそのまま表示されてしまう。代わりに `<` の直後にゼロ幅スペースを挿入し、
 * タグとして認識されないようにする（詳細: docs-ai/info/redmine-textile-offtags.md）
 */
function neutralizeRedmineOfftags(code: string): string {
  return code.replace(REDMINE_OFFTAG_PATTERN, `<${ZERO_WIDTH_SPACE}`);
}

/**
 * 先頭のクラス名を、class 属性に安全に埋め込める文字だけに制限して返す。使えない場合は undefined
 *
 * Bug: クラス配列をそのまま `class="${lang}"` に埋め込んでいたため、複数クラスがカンマ連結され
 * （`python,numberLines`）、`"` を含むクラス名で属性が壊れていた
 * Fix: 先頭のクラスのみを言語名として扱い、`[A-Za-z0-9_+-]` 以外を除去する
 */
function extractLanguageClass(classes: string[]): string | undefined {
  const language = (classes[0] ?? '').replace(/[^A-Za-z0-9_+-]/g, '');
  return language.length ? language : undefined;
}

function action(
  elem: AnyElt,
  format: string,
  meta: PandocMetaMap
): Promise<AnyElt | Array<AnyElt> | void> | AnyElt | Array<AnyElt> | void {
  if (elem.t === 'CodeBlock') {
    const [[_, classes], code] = elem.c;

    // Bug: `${lang}` === 'plantuml' はクラスが 1 つの場合しか成立しなかった
    // Fix: 先頭クラスで判定する
    if (classes[0] === 'plantuml') {
      return RawBlock('html', `{{plantuml\n${code}\n}}\n`);
    }

    // 以前は Redmine で pre タグがネストする問題の回避策として、コードに `<pre>` を含む場合に言語クラスを外していた。
    // neutralizeRedmineOfftags によりコード中の `<pre` はタグとして解釈されなくなったため、回避策は削除した
    const language = extractLanguageClass(classes);
    const syntax = language ? ` class="${language}"` : '';
    return RawBlock(
      'html',
      `<pre><code${syntax}>\n${neutralizeRedmineOfftags(code)}</code></pre>\n`
    );
  } else if (elem.t === 'Code') {
    const [, code] = elem.c;
    return RawInline('html', `<code>${neutralizeRedmineOfftags(code)}</code>`);
  }
}

toJSONFilter(action);
