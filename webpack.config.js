const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'validate',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  mode: 'production',
  externals: {
    'axios': 'axios'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  ],
  resolve: {
    fallback: {
      // Only polyfill what we actually need
      'path': 'path-browserify',
      // Disable everything else
      'fs': false,
      'fs-extra': false,
      'child_process': false,
      'net': false,
      'tls': false,
      'os': false,
      'crypto': false,
      'stream': false,
      'util': false,
      'url': false,
      'querystring': false,
      'http': false,
      'https': false,
      'zlib': false,
      'assert': false,
      'buffer': false,
      'events': false,
      'timers': false,
      'string_decoder': false,
      'constants': false,
      'vm': false
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  target: 'web',
  optimization: {
    minimize: true
  }
};
