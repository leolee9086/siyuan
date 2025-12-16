const fs = require("fs");
const path = require("path");

/**
 * 递归获取目录中的所有文件
 * @param {string} dir 目录路径
 * @param {Array} fileList 文件列表
 * @returns {Array} 文件列表
 */
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

/**
 * 计算文件的行数
 * @param {string} filePath 文件路径
 * @returns {number} 行数
 */
function countLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf8");
        return content.split("\n").length;
    } catch (error) {
        console.error(`读取文件 ${filePath} 时出错:`, error.message);
        return 0;
    }
}

/**
 * 查找最长的文件
 * @param {string} srcPath 源代码目录路径
 */
function findLongestFile(srcPath) {
    console.log(`正在扫描目录: ${srcPath}`);
    
    // 需要忽略的文件列表 - 统一使用正斜杠
    const ignoreFiles = [
        "data/kernelAPI/mimeDb.ts",
        "data/kernelAPI/kernelApiClient.ts",
        "asset/pdf/app.js",
        "types/config.d.ts"
    ];
    
    // 获取所有文件
    const allFiles = getAllFiles(srcPath);
    
    // 过滤掉需要忽略的文件
    const filteredFiles = allFiles.filter(filePath => {
        const relativePath = path.relative(srcPath, filePath);
        // 统一转换为正斜杠格式进行比较
        const normalizedPath = relativePath.replace(/\\/g, "/");
        return !ignoreFiles.some(ignoreFile => normalizedPath.includes(ignoreFile));
    });
    
    console.log(`共找到 ${allFiles.length} 个文件，过滤后剩余 ${filteredFiles.length} 个文件`);
    
    // 计算每个文件的行数
    const fileStats = filteredFiles.map(filePath => {
        const lines = countLines(filePath);
        return {
            path: filePath,
            lines: lines,
            relativePath: path.relative(srcPath, filePath)
        };
    });
    
    // 按行数排序
    fileStats.sort((a, b) => b.lines - a.lines);
    
    // 显示前10个最长的文件
    console.log("\n最长的10个文件:");
    fileStats.slice(0, 10).forEach((file, index) => {
        console.log(`${index + 1}. ${file.relativePath} - ${file.lines} 行`);
    });
    
    // 显示统计信息
    const totalLines = fileStats.reduce((sum, file) => sum + file.lines, 0);
    const averageLines = Math.round(totalLines / fileStats.length);
    
    console.log("\n统计信息:");
    console.log(`总文件数: ${fileStats.length}`);
    console.log(`总行数: ${totalLines}`);
    console.log(`平均行数: ${averageLines}`);
    console.log(`最长文件: ${fileStats[0].relativePath} (${fileStats[0].lines} 行)`);
    
    return fileStats[0];
}

// 主程序
const srcPath = path.join(__dirname, "../../src");
findLongestFile(srcPath);