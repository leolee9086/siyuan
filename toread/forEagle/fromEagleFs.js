/**
 * @fileoverview 提供与 Eagle 素材库文件系统交互的工具函数。
 * 依赖 Node.js 环境 (require, fs, path)。
 */

// 检查是否在 Node.js 环境
if (typeof require !== 'function') {
    console.warn('This module requires Node.js environment (fs, path) and might not work correctly.');
    // 在非 Node 环境下可能需要提供 polyfill 或替代方案，或者阻止执行
}

// 延迟加载 Node.js 模块，仅在函数实际调用时才加载
// 这样可以避免在非 Node 环境下导入时立即抛出错误
let fs, path;
function ensureNodeModules() {
    if (!fs || !path) {
        if (typeof require === 'function') {
            fs = require('fs');
            path = require('path');
        } else {
            throw new Error('Node.js modules (fs, path) are not available.');
        }
    }
}

/**
 * @typedef {object} EagleAsset
 * @property {string} path - 资源文件的绝对路径。
 * // 可以根据需要添加其他属性
 */

/**
 * @typedef {object} EagleAssetMetadataResult
 * @property {string} path - 资源文件的路径。
 * @property {string} metaPath - 找到的 metadata.json 文件路径。
 */

/**
 * 遍历资源列表，查找每个资源同级目录下的 metadata.json 文件。
 * @async (虽然内部操作是同步的，但原函数是 async，保持一致性，未来可能改为异步IO)
 * @param {EagleAsset[]} assets - 包含资源对象（至少有 path 属性）的数组。
 * @returns {Promise<EagleAssetMetadataResult[]>} 返回包含找到元数据文件信息的对象数组。
 */
export const fromEagleFs_findMetadataFiles = async (assets) => {
    ensureNodeModules();
    const results = [];
    if (!Array.isArray(assets)) {
        console.error("Invalid input: assets must be an array.");
        return results; // Return empty for invalid input
    }

    for (const asset of assets) {
        if (!asset || typeof asset.path !== 'string') {
            console.warn("Skipping invalid asset entry:", asset);
            continue;
        }
        try {
            const assetDir = path.dirname(asset.path);
            // Eagle 的 metadata.json 似乎是和文件同名，后缀改为 .json？还是固定叫 metadata.json?
            // 原代码是固定名称，暂时保持一致。
            // TODO: Verify the exact naming convention for Eagle metadata files.
            const metadataPath = path.join(assetDir, 'metadata.json'); // 使用 path.join 保证跨平台兼容性

            // 使用 fs.existsSync 检查文件是否存在 (同步操作)
            if (fs.existsSync(metadataPath)) {
                results.push({
                    path: asset.path,
                    metaPath: metadataPath.replace(/\\/g, '/') // 统一路径分隔符为 /?
                });
            }
        } catch (error) {
            // 只记录错误，不中断循环
            console.log(`Error checking metadata for ${asset.path}:`, error.message);
        }
    }
    return results;
};

/**
 * 根据文件或文件夹路径，向上查找并返回其所在的 Eagle 素材库根目录路径 (.library 结尾)。
 * @param {string} filePath - 文件或文件夹的绝对路径。
 * @returns {string | null} 如果找到素材库路径则返回，否则返回 null。
 */
export const fromEagleFs_findLibraryPath = (filePath) => {
    ensureNodeModules();
    if (typeof filePath !== 'string' || filePath.length === 0) {
        return null;
    }
    try {
        let currentPath = path.resolve(filePath); // 确保是绝对路径
        let rootReached = false;

        while (!rootReached) {
            const baseName = path.basename(currentPath);
            if (baseName.endsWith('.library')) {
                return currentPath.replace(/\\/g, '/'); // 返回找到的库路径
            }

            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) {
                // 到达根目录仍未找到
                rootReached = true;
            }
            currentPath = parentPath;
        }

        return null; // 未找到 .library 目录
    } catch (error) {
        console.error(`Error finding library path for ${filePath}:`, error);
        return null;
    }
};

/**
 * 从指定的 Eagle 素材库路径读取并解析 tags.json 文件。
 * @param {string} libraryPath - Eagle 素材库的根目录路径 (应指向 .library 结尾的目录)。
 * @returns {object | null} 返回解析后的 tags.json 对象，如果文件不存在或解析失败则返回 null。
 */
export const fromEagleFs_getLibraryTags = (libraryPath) => {
    ensureNodeModules();
    if (typeof libraryPath !== 'string' || !libraryPath.endsWith('.library')) {
        console.error("Invalid library path provided. It should end with '.library'.");
        return null;
    }
    try {
        const tagsFilePath = path.join(libraryPath, 'tags.json');
        if (fs.existsSync(tagsFilePath)) {
            const tagJson = fs.readFileSync(tagsFilePath, 'utf8');
            return JSON.parse(tagJson);
        } else {
            console.warn(`tags.json not found in ${libraryPath}`);
            return null;
        }
    } catch (error) {
        console.error(`Error reading or parsing tags.json from ${libraryPath}:`, error);
        return null;
    }
}; 