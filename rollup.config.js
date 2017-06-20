// Reminder: this file is commonjs so that karma can load it

const babel = require(`rollup-plugin-babel`);
const builtins = require(`rollup-plugin-node-builtins`);
const globals = require(`rollup-plugin-node-globals`);
const commonjs = require(`rollup-plugin-commonjs`);
const resolve = require(`rollup-plugin-node-resolve`);

module.exports = {
  format: `iife`,
  plugins: [
    builtins(),
    resolve({
      module: true,
      jsnext: true,
      browser: true,
      main: true
    }),
    babel({
      exclude: [
        `node_modules/**`
      ],
      runtimeHelpers: true
    }),
    commonjs({
      include: [
        `packages/node_modules/**`
      ]
    }),
    globals()
  ]
};
