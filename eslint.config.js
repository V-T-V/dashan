// ESLint 9 flat config —— 大善系统（前端 DOM + Node server/CLI 混合项目）。
// 与工作区兄弟项目（agentresearch / agenttrain）保持一致的规则集。
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', '.git/', '*.log'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        // Node
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      // 对话主循环是合理的串行 await 语义
      'no-await-in-loop': 'off',
      // CLI / server 大量使用 console 作为交互输出
      'no-console': 'off',
    },
  },
  {
    // 前端入口脚本会用到浏览器 DOM/BOM 全局变量
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        HTMLElement: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        AbortController: 'readonly',
      },
    },
  },
);
