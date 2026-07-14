/**
 * Electron 构建中的 Node 模块加载边界。
 * Web 构建会在 resolver 层替换为 browser 版本，因此不会把该语法带入浏览器产物。
 */
export const nativeRequire = <T = unknown>(moduleName: string) => __non_webpack_require__(moduleName);
