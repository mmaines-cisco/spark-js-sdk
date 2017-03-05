const path = require(`path`);
const HtmlWebpackPlugin = require(`html-webpack-plugin`);
const {DefinePlugin, NamedModulesPlugin} = require(`webpack`);

const PROD = process.env.NODE_ENV === `production`;

const filter = (k) => typeof k !== `boolean`;

module.exports = {
  context: path.resolve(__dirname, `src`),
  entry: [
    // activate HMR for React
    PROD || `react-hot-loader/patch`,
    `./scripts/index.js`
  ].filter(filter),
  output: {
    filename: `bundle.js`,
    path: path.resolve(__dirname, `dist`)
  },
  devtool: PROD ? `source-map` : `inline-source-map`,
  target: `web`,
  module: {
    rules: [
      {
        test: /\.js$/,
        loaders: [
          `babel-loader?cacheDirectory`
        ].filter(filter),
        exclude: /node_modules|dist/,
        include: path.resolve(__dirname, `..`)
      },
      {
        test: /\.json$/,
        loader: `json-loader`
      },
      {
        test: /\.css$/,
        loaders: [
          `style-loader?sourceMap`,
          `css-loader?importLoaders&sourceMap`
        ]
      }
    ]
  },
  plugins: [
    PROD || new NamedModulesPlugin(),
    new HtmlWebpackPlugin({
      hash: true,
      inject: true,
      minify: {
        collapseWhitespace: process.env.NODE_ENV === `production`,
        removeComments: process.env.NODE_ENV === `production`,
        removeScriptTypeAttributes: process.env.NODE_ENV === `production`,
        removeStyleLinkTypeAttributes: process.env.NODE_ENV === `production`,
        sortAttributes: true,
        sortClassName: true
      },
      template: path.resolve(__dirname, `./src/index.html`)
    }),
    // Always expose NODE_ENV to webpack, in order to use `process.env.NODE_ENV`
    // inside your code for any environment checks
    new DefinePlugin({
      'process.env': {
        CISCOSPARK_ACCESS_TOKEN: JSON.stringify(process.env.CISCOSPARK_ACCESS_TOKEN),
        NODE_ENV: JSON.stringify(process.env.NODE_ENV)
      }
    })
  ].filter(filter)
};
