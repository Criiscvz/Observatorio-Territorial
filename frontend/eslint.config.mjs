import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import ts from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from './scripts/quality/architecture-plugin.mjs';

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', '.angular/**', 'out-tsc/**'] },
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ts.configs.recommended],
    languageOptions: { parserOptions: { experimentalDecorators: true } },
    processor: angular.processInlineTemplates,
    plugins: { architecture: boundaries },
    rules: {
      // Legacy API/chart payload typing and unused-symbol cleanup are separate work.
      // This first gate enforces correctness without a mass rewrite or a baseline.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'architecture/dependency-direction': 'error',
      'architecture/retired-chart-imports': 'error',
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: angular.templateParser },
    plugins: { '@angular-eslint/template': angular.templatePlugin },
    rules: {
      '@angular-eslint/template/banana-in-box': 'error',
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      '@angular-eslint/template/no-negated-async': 'error',
      '@angular-eslint/template/no-duplicate-attributes': ['error', { allowStylePrecedenceDuplicates: true }],
    },
  },
);
