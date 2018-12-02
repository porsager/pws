import buble from 'rollup-plugin-buble'
import terser from 'rollup-plugin-terser'

export default [{
  input: 'src/index.js',
  plugins: [
    buble()
  ],
  output: [{
    file: 'dist/index.js',
    name: 'PersistentWebSocket',
    format: 'umd'
  }, {
    file: 'dist/index.esm.js',
    format: 'esm'
  }]
}, {
  input: 'src/index.js',
  plugins: [
    buble(),
    terser.terser()
  ],
  output: [{
    file: 'dist/index.min.js',
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
    file: 'dist/index.esm.min.js',
    format: 'esm'
  }]
}]
