// Render language labels at build time; copying is a small progressive
// enhancement, so the original highlighted code remains intact without JS.
export default function codeBlockTransformer() {
  const text = (value) => ({ type: 'text', value });
  const element = (tagName, properties, children) => ({
    type: 'element',
    tagName,
    properties,
    children,
  });
  const names = {
    xml: 'XML',
    python: 'Python',
    py: 'Python',
    bash: 'Bash',
    sh: 'Shell',
    text: 'Text',
    plaintext: 'Text',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    json: 'JSON',
  };
  return {
    name: 'feedstar-code-blocks',
    root(tree) {
      const visit = (parent) => {
        if (!parent.children) return;
        parent.children = parent.children.map((node) => {
          const code =
            node.tagName === 'pre' &&
            node.children?.find((child) => child.tagName === 'code');
          if (!code) {
            visit(node);
            return node;
          }
          const language =
            node.properties?.dataLanguage ??
            node.properties?.['data-language'] ??
            code.properties?.className
              ?.find((name) => name.startsWith('language-'))
              ?.slice(9) ??
            'text';
          const label = names[language] ?? language;
          return element('div', { className: ['code-block'] }, [
            element('div', { className: ['code-toolbar'] }, [
              element('span', { className: ['code-language'] }, [text(label)]),
              element(
                'button',
                {
                  type: 'button',
                  className: ['copy-code'],
                  hidden: true,
                  'aria-label': `复制 ${label} 代码`,
                },
                [
                  element(
                    'span',
                    { className: ['copy-icon'], 'aria-hidden': 'true' },
                    [],
                  ),
                  element('span', { className: ['copy-label'] }, [
                    text('复制'),
                  ]),
                ],
              ),
            ]),
            node,
            element(
              'span',
              { className: ['copy-feedback'], role: 'status' },
              [],
            ),
          ]);
        });
      };
      visit(tree);
    },
  };
}
