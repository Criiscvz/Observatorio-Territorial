import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error('Cannot load architecture path aliases.');
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
const app = path.join(root, 'src/app');
const within = (file, folder) => {
  const relative = path.relative(path.join(app, folder), file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export default {
  rules: {
    'retired-chart-imports': {
      meta: { type: 'problem', schema: [], messages: { unsafe: 'The legacy ECharts analysis has been retired. Keep dataset tables and use the publication viewers for PDFs and Power BI.' } },
      create(context) {
        function check(node, source) {
          if (typeof source === 'string' && /^(echarts|echarts-wordcloud|ngx-echarts)(\/|$)/.test(source)) {
            context.report({ node, messageId: 'unsafe' });
          }
        }
        return {
          ImportDeclaration: node => check(node, node.source.value),
          ExportNamedDeclaration: node => check(node, node.source?.value),
          ExportAllDeclaration: node => check(node, node.source.value),
          ImportExpression: node => check(node, node.source.value),
          TSImportType: node => check(node, (node.argument?.literal ?? node.argument)?.value),
          CallExpression: node => { if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node, node.arguments[0]?.value); },
        };
      },
    },
    'dependency-direction': {
      meta: {
        type: 'problem', schema: [],
        messages: { direction: '{{layer}} cannot depend on {{target}}.' },
      },
      create(context) {
        const file = context.filename;
        const domain = within(file, 'core/domain');
        const entities = within(file, 'core/domain/entities');
        const data = within(file, 'core/data');
        if (!domain && !data) return {};
        function check(node) {
          const source = node?.value;
          if (typeof source !== 'string') return;
          const resolved = ts.resolveModuleName(source, file, options, ts.sys).resolvedModule?.resolvedFileName;
          const ui = resolved && ['features', 'presentation', 'shared/components', 'routes'].some(folder => within(resolved, folder));
          const concrete = resolved && ['core/data', 'core/services', 'core/di', 'core/guards', 'core/interceptors', 'core/loaders'].some(folder => within(resolved, folder));
          const environment = resolved && within(resolved, '../environments');
          const http = source === '@angular/common/http' || source.startsWith('@angular/common/http/');
          const frameworkEntity = entities && (source === 'rxjs' || source.startsWith('rxjs/') || source.startsWith('@angular/'));
          if (ui || (domain && (concrete || environment || http || frameworkEntity))) {
            context.report({ node, messageId: 'direction', data: { layer: domain ? 'Domain' : 'Data', target: source } });
          }
        }
        return {
          ImportDeclaration: node => check(node.source),
          ExportNamedDeclaration: node => check(node.source),
          ExportAllDeclaration: node => check(node.source),
          ImportExpression: node => check(node.source),
          TSImportType: node => check(node.argument?.literal ?? node.argument),
          CallExpression: node => { if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node.arguments[0]); },
        };
      },
    },
  },
};
