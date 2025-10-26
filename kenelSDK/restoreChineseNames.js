import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

console.log('[DEBUG] Script starting now...'); // DEBUG - trying to fix linter errors

// 旧的 API 定义文件路径
const oldDefsPath = path.resolve('./kernelApiDefine.js');
// apiDefs 文件夹路径
const apiDefsDir = './apiDefs';

async function restoreNames() {
    console.log('开始恢复中文名称...');
    let oldApiDefinitions;
    try {
        // 动态导入旧的 kernelApiDefine.js
        const oldDefsModule = await import(pathToFileURL(oldDefsPath).href + '?t=' + Date.now()); // Cache bust
        oldApiDefinitions = oldDefsModule.default;
        if (typeof oldApiDefinitions !== 'object' || oldApiDefinitions === null) {
            console.error('错误：旧的 API 定义未能正确加载为一个对象。');
            return;
        }
        console.log(`成功加载旧的 API 定义，包含 ${Object.keys(oldApiDefinitions).length} 个条目。`);
    } catch (error) {
        console.error(`加载旧的 API 定义文件 (${oldDefsPath}) 失败:`, error);
        return;
    }

    let files;
    try {
        files = await fs.readdir(apiDefsDir);
    } catch (error) {
        console.error(`读取 apiDefs 目录 (${apiDefsDir}) 失败:`, error);
        return;
    }
    
    console.log(`[DEBUG] Found ${files.length} files/dirs in ${apiDefsDir}`);

    let totalUpdatedCount = 0;
    let totalDefsProcessed = 0;
    let filesModifiedCount = 0;
    let actualFilesProcessedCount = 0;

    for (const file of files) {
        if (path.extname(file) !== '.js' || file === 'restoreChineseNames.js') {
            // console.log(`[DEBUG] Skipping file: ${file}`);
            continue;
        }
        actualFilesProcessedCount++;
        console.log(`[DEBUG] Processing file: ${file}`);

        const filePath = path.join(apiDefsDir, file);
        const fileUrl = pathToFileURL(filePath).href;
        let module;
        try {
            // Append a cache-busting query parameter for dynamic import
            module = await import(fileUrl + '?cacheBust=' + Date.now());
        } catch (e) {
            console.error(`导入模块 ${file} 失败:`, e);
            continue;
        }

        const moduleName = path.basename(file, '.js');
        const expectedVarName = `${moduleName}ApiDefs`; // e.g., systemApiDefs
        const currentApiDefs = module[expectedVarName];

        if (!currentApiDefs || !Array.isArray(currentApiDefs)) {
            console.warn(`跳过 ${file}: 未找到有效的 ${expectedVarName} 导出数组。`);
            continue;
        }

        let fileModified = false;
        let updatedInFile = 0;

        for (const apiDef of currentApiDefs) {
            totalDefsProcessed++;
            if (apiDef.en && oldApiDefinitions[apiDef.en]) {
                const oldDef = oldApiDefinitions[apiDef.en];
                const oldPathCleaned = oldDef.路径 ? oldDef.路径.trim() : undefined;
                const currentEndpointCleaned = apiDef.endpoint ? apiDef.endpoint.trim() : undefined;

                if (oldDef.方法 === apiDef.method && oldPathCleaned === currentEndpointCleaned) {
                    if (oldDef.中文名 && apiDef.zh_cn !== oldDef.中文名) {
                        apiDef.zh_cn = oldDef.中文名;
                        fileModified = true;
                        updatedInFile++;
                    }
                } else {
                    if (oldDef.中文名 && apiDef.zh_cn !== oldDef.中文名) {
                        apiDef.zh_cn = oldDef.中文名;
                        fileModified = true;
                        updatedInFile++;
                        console.log(`注意: 为 ${apiDef.en} (${apiDef.method} ${apiDef.endpoint}) 恢复了中文名 "${oldDef.中文名}"。旧定义为 (${oldDef.方法} ${oldDef.路径})。请检查差异。`);
                    }
                }
            } else if (apiDef.en) {
                // console.log(`信息: API ${apiDef.en} (${apiDef.method} ${apiDef.endpoint}) 在旧定义文件中未找到对应条目。`);
            }
        }

        if (fileModified) {
            filesModifiedCount++;
            totalUpdatedCount += updatedInFile;
            const newContent = `export const ${expectedVarName} = ${JSON.stringify(currentApiDefs, null, 2)};\n`;
            try {
                await fs.writeFile(filePath, newContent, 'utf8');
                console.log(`已更新 ${file}，恢复了 ${updatedInFile} 个中文名称。`);
            } catch (writeError) {
                console.error(`写入文件 ${filePath} 失败:`, writeError);
            }
        }
    }
    console.log(
        '\n中文名称恢复完成。\n' +
        '共扫描 ' + actualFilesProcessedCount + ' 个 apiDef JS 文件。\n' +
        '共检查 ' + totalDefsProcessed + ' 个 API 定义。\n' +
        '共更新 ' + filesModifiedCount + ' 个文件中的 ' + totalUpdatedCount + ' 个中文名称。\n'
    );
}

restoreNames()
    .catch(err => {
        console.error('[CRITICAL] Error in restoreNames:', err);
    })
    .finally(() => {
        console.log('[DEBUG] Script finished.');
    });