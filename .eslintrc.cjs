module.exports = {
  root: true,
  env: { es2022: true, browser: true, node: true },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  ignorePatterns: ['dist', 'build', 'node_modules'],
  rules: {
    'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    'complexity': ['warn', 10],
  },
}
