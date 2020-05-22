import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'src/script.js',
    output: {
        file: 'public/script.js',
        format: 'umd'
    },
    plugins: [
        commonjs(),
        resolve()
    ]
}
