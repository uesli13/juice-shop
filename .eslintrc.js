/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

module.exports = {
  extends: 'standard-with-typescript',
  root : true,
  env: {
    browser: true,
    node: true,
    jasmine: true,
    mocha: true,
    jest: true
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2018,
    project: './src/tsconfig.*.json',
    sourceType: 'module'
  },
  ignorePatterns: [
    '.eslintrc.js',
    'app/private/**',
    'vagrant/**',
    'frontend/**',
    'dist/**'
  ],
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      rules: {
        'no-void': 'off', // conflicting with recommendation from @typescript-eslint/no-floating-promises
        // FIXME warnings below this line need to be checked and fixed.
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off', // requires the `strictNullChecks` compiler option
        '@typescript-eslint/no-explicit-any': 'error', // disallow usage of the `any` type
        // FIXME warnings below this line need to be checked and fixed.
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/consistent-type-assertions': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/no-confusing-void-expression': 'off',
      }
    }
  ]
}
