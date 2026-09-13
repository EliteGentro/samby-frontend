import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['docs/evidence-analysis/*.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/(?:^|\\s)bg-white(?:\\s|$)/]:not([value=/dark:bg-/])',
          message:
            'Avoid hardcoded "bg-white" without a "dark:bg-" variant. Use semantic design tokens like "bg-card" or "bg-background".',
        },
        {
          selector:
            'JSXAttribute[name.name="className"] TemplateElement[value.raw=/(?:^|\\s)bg-white(?:\\s|$)/]:not([value.raw=/dark:bg-/])',
          message:
            'Avoid hardcoded "bg-white" without a "dark:bg-" variant. Use semantic design tokens like "bg-card" or "bg-background".',
        },
        {
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/(?:^|\\s)(?:bg|text|border)-slate-\\d+(?:\\s|$)/]:not([value=/dark:/])',
          message:
            'Avoid hardcoded Tailwind slate classes without dark variants. Use semantic tokens (bg-card, border-border, text-foreground, text-muted-foreground) instead.',
        },
        {
          selector:
            'JSXAttribute[name.name="className"] TemplateElement[value.raw=/(?:^|\\s)(?:bg|text|border)-slate-\\d+(?:\\s|$)/]:not([value.raw=/dark:/])',
          message:
            'Avoid hardcoded Tailwind slate classes without dark variants. Use semantic tokens (bg-card, border-border, text-foreground, text-muted-foreground) instead.',
        },
      ],
    },
  },
)
