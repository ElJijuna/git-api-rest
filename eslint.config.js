import eslintTs from 'super-configs/eslint/ts';
import eslintReactTsx from 'super-configs/eslint/react/tsx';

export default [
  { ignores: ['dist/**', 'ui/dist/**', 'node_modules/**', 'ui/src/routeTree.gen.ts'] },
  ...eslintTs.map(cfg => ({ ...cfg, files: ['src/**/*.ts'] })),
  ...eslintReactTsx.map(cfg => ({ ...cfg, files: ['ui/src/**/*.tsx', 'ui/src/**/*.ts'] })),
];
