const webpack = require("webpack");
const path = require("path");
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const production = 'NODE_ENV' in process.env && process.env.NODE_ENV === 'production'
const plugins = [
  new webpack.DefinePlugin({
    Debug: JSON.stringify(!production)
  }),
  new webpack.LoaderOptionsPlugin({
    debug: !production
  }),
  new webpack.optimize.ModuleConcatenationPlugin()
]
if (!production) {
  plugins.push(new webpack.NamedModulesPlugin())
}
if (production) {
  plugins.push(new UglifyJSPlugin())
}



module.exports = {
    entry: [
        "./src/index.ts",
    ],
    output: {
        filename: "bundle.js",
    },
    plugins: plugins,

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        extensions: [".webpack.js", ".web.js", ".ts", ".js"]
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loaders: [
                    "awesome-typescript-loader"
                ],
                exclude: path.resolve(__dirname, 'node_modules'),
                include: path.resolve(__dirname, "src"),
            },
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            },
            {
                test: /\.css$/,
                use: [ 'style-loader', 'css-loader' ],
                include: [path.resolve(__dirname, "node_modules"),
                          path.resolve(__dirname, "src")]
            }
          ]
    }
};
