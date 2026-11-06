import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });
async function lint(code, file = 'src/app/core/domain/usecases/quality-probe.ts') {
  return (await eslint.lintText(code, { filePath: path.join(root, file) })).flatMap(result => result.messages);
}
const blocked = async (code, file) => assert((await lint(code, file)).some(m => m.ruleId === 'architecture/dependency-direction'), code);

test('domain blocks concrete services through aliases, relative paths, exports and lazy imports', async () => {
  for (const code of [
    "import { UserService } from '@core/services/user.service';",
    "export * from '../../services/user.service';",
    "export { UserService } from '@core/services/user.service';",
    "const service = import('@core/services/user.service');",
    "const service = require('@core/services/user.service');",
    "type Service = import('@core/services/user.service').UserService;",
    "import { HttpClient } from '@angular/common/http';",
  ]) await blocked(code);
});

test('data cannot import presentation and entity types stay independent of Angular', async () => {
  await blocked("export * from '@presentation/viewmodels/auth.viewmodel';", 'src/app/core/data/quality-probe.ts');
  await blocked("import { signal } from '@angular/core';", 'src/app/core/domain/entities/quality-probe.ts');
  await blocked("export * from '@environments/environment';");
});

test('the existing injection and observable contracts remain permitted', async () => {
  assert.deepEqual(await lint("import { inject } from '@angular/core'; import { Observable } from 'rxjs'; import { AuthRepository } from '../repositories';"), []);
  assert.deepEqual(await lint("export interface Publication { id: string; }", 'src/app/core/domain/entities/quality-probe.ts'), []);
  assert.deepEqual(await lint("import { HttpClient } from '@angular/common/http';", 'src/app/core/data/quality-probe.ts'), []);
});

test('the correctness gate rejects debugger statements and inline suppression cannot bypass it', async () => {
  assert((await lint('debugger;')).some(m => m.ruleId === 'no-debugger'));
  assert((await lint('// eslint-disable-next-line no-debugger\ndebugger;')).some(m => m.ruleId === 'no-debugger'));
  await blocked("/* eslint-disable architecture/dependency-direction */\nimport { UserService } from '@core/services/user.service';");
});

test('external templates reject duplicate attributes but accept Angular class precedence', async () => {
  const file = 'src/app/features/quality-probe.component.html';
  assert((await lint('<button title="A" title="B">Save</button>', file)).some(m => m.ruleId === '@angular-eslint/template/no-duplicate-attributes'));
  assert.deepEqual(await lint('<div class="base" [class]="dynamicClass"></div>', file), []);
  assert((await lint('<input ([value])="name">', file)).some(m => m.ruleId === '@angular-eslint/template/banana-in-box'));
});

test('inline Angular templates receive the same checks', async () => {
  const code = "import { Component } from '@angular/core'; @Component({template: '<button title=\"A\" title=\"B\">Save</button>'}) export class QualityProbe {}";
  assert((await lint(code, 'src/app/features/quality-probe.component.ts')).some(m => m.ruleId === '@angular-eslint/template/no-duplicate-attributes'));
});

test('ECharts full runtime bundles and LinesChart cannot bypass the modular registry', async () => {
  const file = 'src/app/features/quality-probe.ts';
  for (const code of [
    "import * as charts from 'echarts';", "const charts = import('echarts');",
    "import { LinesChart as Series } from 'echarts/charts';", "export * from 'echarts/charts';",
    "import * as charts from 'echarts/charts';", "const charts = require('echarts/dist/echarts');",
  ]) assert((await lint(code, file)).some(m => m.ruleId === 'architecture/echarts-modular-imports'), code);
  assert.deepEqual(await lint("import type { EChartsOption } from 'echarts'; import { LineChart } from 'echarts/charts';", file), []);
});
