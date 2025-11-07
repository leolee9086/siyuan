const fs = require('fs');
const path = require('path');

/**
 * Patch文件解析器插件
 * 当存在XXXX.patch.ts文件时，将所有对XXXX.ts的引用重定向到XXXX.patch.ts
 * 支持所有文件类型的patch版本
 */
class PatchResolverPlugin {
    constructor(options = {}) {
        this.options = {
            patchSuffix: '.patch',
            extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue'],
            ...options
        };
    }

    apply(compiler) {
        const pluginName = 'PatchResolverPlugin';
        
        // 使用 compilation 钩子来获取 normalModuleFactory
        compiler.hooks.compilation.tap(pluginName, (compilation, { normalModuleFactory }) => {
            // 获取 normalModuleFactory 的 resolver
            normalModuleFactory.hooks.beforeResolve.tap(pluginName, (resolveData) => {
                // 只处理相对路径和绝对路径的文件请求
                if (!resolveData.request || !resolveData.context) {
                    return;
                }

                // 构建完整的文件路径
                const fullPath = path.resolve(resolveData.context, resolveData.request);
                
                // 查找对应的patch文件
                const patchPath = this.findPatchFile(fullPath);

                if (patchPath) {
                    // 找到patch文件，重定向到patch文件
                    console.log(`[PatchResolver] 重定向: ${fullPath} -> ${patchPath}`);
                    resolveData.request = patchPath;
                }

                // 不返回任何值，因为这是一个 bailing hook
                return;
            });
        });
    }

    /**
     * 查找对应的patch文件
     * @param {string} originalPath 原始文件路径
     * @returns {string|null} patch文件路径或null
     */
    findPatchFile(originalPath) {
        // 获取文件扩展名
        const ext = path.extname(originalPath);
        
        // 如果有扩展名，直接构建patch文件路径
        if (ext) {
            const nameWithoutExt = originalPath.slice(0, -ext.length);
            const patchPath = `${nameWithoutExt}${this.options.patchSuffix}${ext}`;
            
            // 检查patch文件是否存在
            if (fs.existsSync(patchPath)) {
                return patchPath;
            }
            return null;
        }
        
        // 如果没有扩展名，尝试常见的扩展名
        for (const extension of this.options.extensions) {
            const nameWithExt = `${originalPath}${extension}`;
            const patchPath = `${originalPath}${this.options.patchSuffix}${extension}`;
            
            // 检查原始文件和patch文件是否都存在
            if (fs.existsSync(nameWithExt) && fs.existsSync(patchPath)) {
                return patchPath;
            }
        }
        
        return null;
    }
}

module.exports = PatchResolverPlugin;