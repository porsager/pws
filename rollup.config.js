import buble from 'rollup-plugin-buble'
import terser from 'rollup-plugin-terser'

export default [{
  input: 'src/index.js',
  plugins: [
    buble()
  ],
  output: [{
    file: 'lib/index.js',
    name: 'PersistentWebSocket',
    format: 'umd'
  }, {
    file: 'lib/index.esm.js',
    format: 'esm'
  }]
}, {
  input: 'src/index.js',
  plugins: [
    buble(),
    terser.terser()
  ],
  output: [{
    file: 'lib/index.min.js',
    name: 'PersistentWebSocket',
    format: 'umd'
  }]
}, {
  input: 'src/index.js',
  plugins: [
    buble(),
    terser.terser()
  ],
  output: [{
    file: 'lib/index.esm.min.js',
    format: 'esm'
  }]
}]
