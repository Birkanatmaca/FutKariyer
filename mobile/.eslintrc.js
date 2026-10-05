module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['scripts/*.cjs'],
      env: {node: true},
      parserOptions: {ecmaVersion: 2022, sourceType: 'script'},
    },
    {
      files: ['vite.config.mjs'],
      env: {node: true},
      parserOptions: {ecmaVersion: 2022, sourceType: 'module'},
    },
    {
      files: ['web/*.js'],
      env: {browser: true},
      parserOptions: {ecmaVersion: 2022, sourceType: 'module'},
    },
  ],
};
