/**
 * @types {}
 */
const config = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    'plugin:sonarjs/recommended',
    'plugin:jest/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    'jest/globals': true,
    es6: true,
    node: true,
  },
  plugins: [
    'jest',
    'sonarjs',
    'functional',
    '@typescript-eslint',
    'prettier',
    'total-functions',
  ],
  rules: {
    'total-functions/no-unsafe-mutable-readonly-assignment': 'error',
    'functional/no-expression-statement': 'off',
    'functional/no-conditional-statement': 'off',
  },
};

module.exports = config;
