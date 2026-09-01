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

function createConfig(targetName, argv, env = {}) {
    const t = targets[targetName];
    const isProd = argv.mode === "production";
    const isElectron = t.platform === "electron";
    const isLibrary = !!t.library;
    const isModuleLibrary = t.library?.format === "module";
    const oneShot = env.oneShot === true || env.oneShot === "true";
    const outputDir = env.outputDir
        ? path.resolve(__dirname, env.outputDir)
        : path.resolve(__dirname, t.outputDir);

    return {
        name: targetName,
        target: isElectron ? "electron-renderer" : "web",
        // The app target is also served by the browser-based dev/core host.
        // Keep webpack's runtime chunk loader valid when Electron's Node global
        // is unavailable instead of emitting a bare `global` reference.
        node: { global: true },
        mode: argv.mode || "development",
        watch: !isProd && !oneShot,
        cache: isProd ? undefined : false,
        devtool: isProd ? false : "eval-source-map",
        entry: t.entry,
        output: buildOutput(t, isLibrary, isProd, outputDir),
        resolve: buildResolve(t, isElectron),
        optimization: {
            minimize: isProd,
            minimizer: [
                new EsbuildPlugin({
                    target: "es2020",
                    sourcemap: !isProd,
                    ...(isModuleLibrary ? { format: "esm" } : {}),
                }),
            ],
            // 把 webpack runtime 提到独立小文件，避免业务码变动连带改变 vendors/common 的 chunkhash
            runtimeChunk: isModuleLibrary ? false : "single",
            splitChunks: isModuleLibrary ? false : {
                chunks: "all",
                minSize: 20000,
                cacheGroups: {
                    // MP3 编码器仅由录音 Worker 使用，单独分包可避免主界面提前加载。
                    recordMediaEncoder: {
                        test: /[\\/]node_modules[\\/]@breezystack[\\/]lamejs[\\/]/,
                        name: "record-media-encoder",
                        chunks: "all",
                        priority: 20,
                        enforce: true,
                    },
                    // 第三方依赖统一进 vendors chunk（dayjs、iconv-lite、@tiptap/* 等）
                    vendors: {
                        test: /[\\/]node_modules[\\/]/,
                        name: "vendors",
                        chunks: "all",
                        priority: 10,
                    },
                    // main 与 window 两入口共享的业务码（constants / layout / protyle / editor / plugin ...），
                    // 提取到 common chunk 以消除两入口约 90% 的重复打包
                    common: {
                        name: "common",
                        chunks: "all",
                        minChunks: 2,
                        priority: 5,
                        reuseExistingChunk: true,
                    },
                },
            },
        },
        module: { rules: buildRules(t, isProd, isLibrary) },
        plugins: buildPlugins(t, argv, isProd, isLibrary, targetName, outputDir),
        experiments: isModuleLibrary ? { outputModule: true } : undefined,
    };
}

function buildOutput(t, isLibrary, isProd, outputDir) {
    const output = {
        publicPath: t.publicPath,
        filename: isLibrary
            ? (pathData) => pathData.chunk?.name === "agent-panel" ? "agent-panel.js"
                : t.library?.format === "module" ? "[name].js" : "[name].[contenthash].js"
            : "[name].[chunkhash].js",
        path: outputDir,
        // Electron and browser-hosted builds share the same chunks; use the
        // standards-based root object so webpack never emits bare `global`.
        globalObject: "globalThis",
    };
    if (t.library) {
        if (t.library.format === "module") {
            output.module = true;
            output.library = { type: "module" };
            output.chunkFilename = isProd ? "[name].[contenthash].js" : "[name].js";
        } else {
            output.library = t.library.name;
            output.libraryTarget = t.library.format;
            output.libraryExport = t.library.export;
        }
    }
    return output;
}

function buildResolve(t, isElectron) {
    const alias = { "@": path.resolve(__dirname, "src") };
    if (!isElectron) {
        alias["vue"] = "vue/dist/vue.esm-bundler.js";
        // Match the relative requests used by the platform boundary. Using an
        // absolute filesystem path as an alias key makes Watchpack treat the
        // file itself as a directory during its initial scan on Windows.
        const browserNativeRequire = path.resolve(__dirname, "src/platform/nativeRequire.browser.ts");
        alias["../platform/nativeRequire$"] = browserNativeRequire;
        alias["../../platform/nativeRequire$"] = browserNativeRequire;
        alias["../nativeRequire$"] = browserNativeRequire;
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

function buildPlugins(t, argv, isProd, isLibrary, targetName, outputDir) {
    const targetPlatform = t.platform === "electron"
        ? "electron"
        : (targetName === "mobile" || targetName.endsWith("-mobile") ? "browser-mobile" : "browser-desktop");
    const plugins = [
        new PatchResolverPlugin(),
        new CleanWebpackPlugin({
            cleanStaleWebpackAssets: false,
            cleanOnceBeforeBuildPatterns: [outputDir],
        }),
        new webpack.DefinePlugin({
            SIYUAN_VERSION: JSON.stringify(pkg.version),
            NODE_ENV: JSON.stringify(argv.mode),
            __VUE_OPTIONS_API__: JSON.stringify(true),
            __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
            __SFORGE_PLATFORM__: JSON.stringify(targetPlatform),
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
            ...(t.library?.format === "module" ? {scriptLoading: "module"} : {}),
        }));
    }

    return plugins;
}

module.exports = (env, argv) => {
    if (env?.target) return createConfig(env.target, argv, env);
    return Object.keys(targets).map(name => createConfig(name, argv, env));
};
