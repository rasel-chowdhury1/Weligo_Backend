// ESLint 9 requires a flat config (eslint.config.js) - the project previously
// only had .eslintrc.json (the pre-v9 format), which v9 can no longer read
// directly, so `eslint .` failed outright. This bridges the *existing*
// .eslintrc.json config as-is via ESLint's own official FlatCompat utility
// (the recommended migration path - see
// https://eslint.org/docs/latest/use/configure/migration-guide) rather than
// hand-rewriting the rules/extends into flat-config syntax, so behavior
// stays identical to what .eslintrc.json already specified.
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    // mirrors the old .eslintignore, which ESLint 9 no longer reads
    ignores: ['node_modules/**', 'dist/**', '.env'],
  },
  ...compat.config(require('./.eslintrc.json')),
];
