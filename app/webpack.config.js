const path = require("path");
const webpack = require("webpack");
const pkg = require("./package.json");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { EsbuildPlugin } = require("esbuild-loader");
const { VueLoaderPlugin } = require("vue-loader");
const PatchResolverPlugin = require("./webpack.patchResolver");
const targets = require("./build.targets.json");

function createConfig(targetName, argv) {
    const t = targets[targetName];
    const isProd = argv.mode === "production";
    const isElectron = t.platform === "electron";
    const isLibrary = !!t.library;

    return {
        name: targetName,
        target: isElectron ? "electron-renderer" : "web",
        mode: argv.mode || "development",
        watch: !isProd,
        devtool: isProd ? false : "eval-source-map",
        entry: t.entry,
        output: buildOutput(t, isLibrary),
        resolve: buildResolve(t, isElectron),
        optimization: {
            minimize: isProd,
            minimizer: [
                new EsbuildPlugin({
                    target: "es2020",
                    sourcemap: !isProd,
                }),
            ],
        },
        module: { rules: buildRules(t, isProd, isLibrary) },
        plugins: buildPlugins(t, argv, isProd, isLibrary),
    };
}

function buildOutput(t, isLibrary) {
    const output = {
        publicPath: t.publicPath,
        filename: isLibrary ? "[name].js" : "[name].[chunkhash].js",
        path: path.resolve(__dirname, t.outputDir),
    };
    if (t.library) {
        output.library = t.library.name;
        output.libraryTarget = t.library.format;
        output.libraryExport = t.library.export;
    }
    return output;
}

function buildResolve(t, isElectron) {
    const alias = { "@": path.resolve(__dirname, "src") };
    if (!isElectron) {
        alias["vue"] = "vue/dist/vue.esm-bundler.js";
    }
    if (t.excludeModules) {
        for (const mod of t.excludeModules) {
            alias[mod + "$"] = false;
        }
    }
    const resolve = {
        extensions: [".vue", ".ts", ".js", ".tpl", ".scss", ".png", ".svg"],
        alias,
    };
    if (!isElectron) {
        resolve.fallback = { "path": require.resolve("path-browserify") };
    }
    return resolve;
}

function buildRules(t, isProd, isLibrary) {
    const rules = [
        {
            test: /\.vue$/,
            loader: "vue-loader",
            options: {
                compilerOptions: {
                    hoistStatic: false,
                    cacheHandlers: false,
                    isTS: true,
                },
            },
        },
        {
            test: /\.ts(x?)$/,
            include: [path.resolve(__dirname, "src")],
            use: [{
                loader: "esbuild-loader",
                options: { target: "es2020", sourcemap: !isProd, loader: "ts" },
            }],
        },
        {
            test: /\.js$/,
            include: [path.resolve(__dirname, "src")],
            enforce: "post",
            use: [{
                loader: "esbuild-loader",
                options: { target: "es2020", sourcemap: !isProd },
            }],
        },
        {
            test: /\.scss$/,
            use: [
                isLibrary
                    ? MiniCssExtractPlugin.loader
                    : (process.env.NODE_ENV !== "production" ? "vue-style-loader" : MiniCssExtractPlugin.loader),
                { loader: "css-loader", options: { sourceMap: !isProd } },
                { loader: "sass-loader", options: { sourceMap: !isProd } },
            ],
        },
        {
            test: /\.css$/,
            use: [
                isLibrary
                    ? MiniCssExtractPlugin.loader
                    : (process.env.NODE_ENV !== "production" ? "vue-style-loader" : MiniCssExtractPlugin.loader),
                { loader: "css-loader", options: { sourceMap: !isProd } },
            ],
        },
    ];

    if (t.html.length > 0) {
        rules.splice(1, 0, {
            test: /\.tpl/,
            include: t.html.map(h => path.resolve(__dirname, h.template)),
            loader: "html-loader",
            options: { sources: false },
        });
    }

    if (!isLibrary) {
        rules.push({
            test: /\.(png|svg)$/,
            use: [{
                loader: "file-loader",
                options: { name: "[name].[ext]", outputPath: "../../" },
            }],
        });
    }

    return rules;
}

function buildPlugins(t, argv, isProd, isLibrary) {
    const plugins = [
        new PatchResolverPlugin(),
        new CleanWebpackPlugin({
            cleanStaleWebpackAssets: false,
            cleanOnceBeforeBuildPatterns: [path.join(__dirname, t.outputDir)],
        }),
        new webpack.DefinePlugin({
            SIYUAN_VERSION: JSON.stringify(pkg.version),
            NODE_ENV: JSON.stringify(argv.mode),
            __VUE_OPTIONS_API__: JSON.stringify(true),
            __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
        }),
        new VueLoaderPlugin(),
        new MiniCssExtractPlugin({
            filename: isLibrary ? "base.css" : "base.[contenthash].css",
        }),
    ];

    for (const h of t.html) {
        plugins.push(new HtmlWebpackPlugin({
            inject: "head",
            chunks: h.chunks,
            filename: h.filename,
            template: h.template,
        }));
    }

    return plugins;
}

module.exports = (env, argv) => {
    if (env?.target) return createConfig(env.target, argv);
    return Object.keys(targets).map(name => createConfig(name, argv));
};
