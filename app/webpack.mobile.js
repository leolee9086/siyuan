// S-Forge 墓碑文件（Tombstone）
// 本文件在本地分支被有意删除：架构重构 —— 多个 webpack 配置文件合并为动态生成的统一配置（commit 9c2768b6d0）。
// 本地替代/迁移到：app/webpack.config.js + app/build.targets.json（"mobile" 目标；构建脚本 dev:mobile / build:mobile）。
// 上游 v3.8.0 对该文件的增量（经评审）：
//   1. .ts 规则的 esbuild-loader 选项新增 supported: { "import-meta": true }（唯一增量，+3 行）。
// 增量去向：无需移植。统一配置中 esbuild-loader / EsbuildPlugin 的目标为 es2020，import.meta 原生受支持；上游添加此开关仅因其旧配置 target 为 es6。
// 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
module.exports = {};
