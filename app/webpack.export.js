const path = require("path");
const webpack = require("webpack");
const pkg = require("./package.json");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
// const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const {EsbuildPlugin} = require("esbuild-loader");
const {VueLoaderPlugin} = require("vue-loader");

module.exports = (env, argv) => {
    return {
        mode: argv.mode || "development",
        watch: argv.mode !== "production",
        devtool: argv.mode !== "production" ? "eval-source-map" : false,
        output: {
            publicPath: "auto",
            filename: "[name].js",
            path: path.resolve(__dirname, "stage/build/export"),
            libraryTarget: "umd",
            library: "Protyle",
            libraryExport: "default",
        },
        entry: {
            "protyle-method": "./src/protyle/method.ts",
        },
        optimization: {
            minimize: true,
            minimizer: [
                new EsbuildPlugin({
                    target: "es6",
                    sourcemap: argv.mode !== "production",
                }),
            ],
        },
        resolve: {
            fallback: {
                "path": require.resolve("path-browserify"),
            },
            extensions: [".vue", ".ts", ".js", ".scss", ".png", ".svg"],
            alias: {
                '@': path.resolve(__dirname, 'src'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: "vue-loader",
                    options: {
                        compilerOptions: {
                            hoistStatic: false,
                            cacheHandlers: false,
                            isTS: true,
                        }
                    }
                },
                {
                    test: /\.ts(x?)$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "es6",
                                sourcemap: argv.mode !== "production",
                                loader: "ts",
                            }
                        },
                        {
                            loader: "ifdef-loader",
                            options: {
                                "ifdef-verbose": false,
                                BROWSER: true,
                                MOBILE: true,
                            },
                        },
                    ],
                },
                {
                    test: /\.js$/,
                    include: [path.resolve(__dirname, "src")],
                    enforce: "post",
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "es6",
                                sourcemap: argv.mode !== "production",
                            },
                        },
                        {
                            loader: "ifdef-loader",
                            options: {
                                "ifdef-verbose": false,
                                BROWSER: true,
                                MOBILE: false,
                            },
                        },
                    ],
                },
                {
                    test: /\.scss$/,
                    include: [
                        path.resolve(__dirname, "src/assets/scss"),
                    ],
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader", // translates CSS into CommonJS
                            options: {
                                sourceMap: argv.mode !== "production",
                            },
                        },
                        {
                            loader: "sass-loader", // compiles Sass to CSS
                            options: {
                                sourceMap: argv.mode !== "production",
                            },
                        },
                    ],
                },
            ],
        },
        plugins: [
            // new BundleAnalyzerPlugin(),
            new CleanWebpackPlugin({
                cleanOnceBeforeBuildPatterns: [
                    path.join(__dirname, "stage/build/export")],
            }),
            new webpack.DefinePlugin({
                NODE_ENV: JSON.stringify(argv.mode),
                SIYUAN_VERSION: JSON.stringify(pkg.version),
                __VUE_OPTIONS_API__: JSON.stringify(true),
                __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
            }),
            new VueLoaderPlugin(),
            new MiniCssExtractPlugin({
                filename: "base.css",
            }),
        ],
    };
};

