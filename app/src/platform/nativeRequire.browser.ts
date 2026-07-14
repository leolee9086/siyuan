/** Web 构建中的 Node 模块占位；正常浏览器路径不应触发该函数。 */
export const nativeRequire = <T = unknown>(moduleName: string) => {
    throw new Error(`Native module is unavailable in browser environment: ${moduleName}`);
};
