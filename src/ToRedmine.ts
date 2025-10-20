import { RawBlock, RawInline, AnyElt, PandocMetaMap, toJSONFilter } from 'pandoc-filter';

//

function action(
  elem: AnyElt,
  format: string,
  meta: PandocMetaMap
): Promise<AnyElt | Array<AnyElt> | void> | AnyElt | Array<AnyElt> | void {
  if (elem.t === 'CodeBlock') {
    const [[_, langOrig], code] = elem.c;
    let lang = langOrig;

    // Workaround: remove language if code contains HTML pre tag
    // Redmine has issues with nested pre tags
    if (code.includes('<pre>')) {
      lang = [];
    }
    const syntax = lang.length ? ` class="${lang}"` : '';
    // const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (`${lang}` === 'plantuml') {
      return RawBlock('html', `{{plantuml\n${code}\n}}\n`);
    } else {
      return RawBlock('html', `<pre><code${syntax}>\n${code}</code></pre>\n`);
    }
  } else if (elem.t === 'Code') {
    const [, code] = elem.c;
    return RawInline('html', `<code>${code}</code>`);
  }
}

toJSONFilter(action);
