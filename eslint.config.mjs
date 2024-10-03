// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylisticJs from '@stylistic/eslint-plugin-js';
import stylisticTs from '@stylistic/eslint-plugin-ts';
import parserTs from '@typescript-eslint/parser';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      parser: parserTs,
    },
  },
  {
    ignores: [
      'build/**/*.ts',
      'build/**',
      "**/*.mjs",
      "eslint.config.mjs",
      "**/*.js",
      "e2e/**",
      "__mocks__/**",
    ],
  },
  {
    files: ['src/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    "plugins": {
      "@stylistic/js": stylisticJs,
      "@stylistic/ts": stylisticTs
    },
    "rules": {
      "@typescript-eslint/no-unused-vars": [
        "warn", // or "error"
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "@typescript-eslint/no-this-alias": [
        "off",
        {
          "files": ["src/usecases/geocode/services/trie/char-node.ts"],
        }
      ],
      '@typescript-eslint/no-explicit-any': [
        "off",
        {
          "files": ["src/usecases/geocode/services/trie/char-node.ts"],
        }
      ],
      '@typescript-eslint/no-empty-object-type': [
        "off",
      ],
      '@typescript-eslint/no-namespace': [
        'off',
        {
          "files": ['src/domain/types/messages/abrg-message.ts'],
        }
      ],
      '@stylistic/ts/semi': 'error',
      '@stylistic/ts/indent': ['error', 2],
      '@stylistic/js/eol-last': 'error',
      '@stylistic/js/comma-dangle': ['error', 'always-multiline'],
    },
  }
);