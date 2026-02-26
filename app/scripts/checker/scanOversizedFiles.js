#!/usr/bin/env node

/**
 * 扫描超过300行实际代码的文件
 * 
 * 计算方式与 code-size/max-lines lint 规则一致：
 * - 跳过空行
 * - 跳过注释行（单行注释 // 和多行注释 /* ... *​/）
 * 
 * 输出 JSON 到 stdout
 */

const fs = require("fs");
const path = require("path");

const SRC_PATH = path.join(__dirname, "../../src");
const MAX_LINES = 300;

/** 需要忽略的文件模式 */
const IGNORE_PATTERNS = [
    /\.js$/,
    /\.remote\.ts$/,
    /\.backup\.ts$/,
    /\.ts\.backup$/,
    /\.old$/,           // .old 备份文件（含 .ts.old）
    /\.bak$/,           // .bak 备份文件（含 .ts.bak）
    /\.scss$/,
    /\.css$/,
    /\.json$/,
    /\.html$/,
    /\.svg$/,
    /\.png$/,
    /\.icns$/,          // macOS 图标资源
    /\.ico$/,
    /\.md$/,            // Markdown 文档
    /\.d\.ts$/,
    /data[/\\]kernelAPI[/\\]/,
    /asset[/\\]pdf[/\\]/,
    /types[/\\]config\.d\.ts$/,
    /types[/\\]i18n\.types\.ts$/,
    /types[/\\]index\.d\.ts$/,
];

/**
 * 递归获取目录中的所有文件
 */
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

/**
 * 计算实际代码行数（排除空行和注释）
 * 与 code-size/max-lines lint 规则的计算方式一致
 */
function countCodeLines(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    
    // 如果文件以换行符结尾，移除最后的空行（与 lint 规则一致）
    if (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
    }

    let codeLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // 跳过空行
        if (trimmed === "") continue;

        // 处理多行注释
        if (inBlockComment) {
            if (trimmed.includes("*/")) {
                inBlockComment = false;
            }
            continue;
        }

        // 多行注释开始
        if (trimmed.startsWith("/*")) {
            if (!trimmed.includes("*/")) {
                inBlockComment = true;
            }
            continue;
        }

        // 单行注释
        if (trimmed.startsWith("//")) continue;

        codeLines++;
    }

    return { codeLines, totalLines: lines.length };
}

/**
 * 判断文件是否应被忽略
 */
function shouldIgnore(filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    return IGNORE_PATTERNS.some(pattern => pattern.test(normalized));
}

// 主程序
const allFiles = getAllFiles(SRC_PATH);
const targetFiles = allFiles.filter(f => !shouldIgnore(f));

const oversized = [];

for (const filePath of targetFiles) {
    try {
        const { codeLines, totalLines } = countCodeLines(filePath);
        if (codeLines > MAX_LINES) {
            oversized.push({
                path: path.relative(SRC_PATH, filePath).replace(/\\/g, "/"),
                codeLines,
                totalLines,
                overRatio: +(codeLines / MAX_LINES).toFixed(1),
            });
        }
    } catch (e) {
        // 跳过无法读取的文件
    }
}

oversized.sort((a, b) => b.codeLines - a.codeLines);

const result = {
    timestamp: new Date().toISOString(),
    threshold: MAX_LINES,
    totalScanned: targetFiles.length,
    oversizedCount: oversized.length,
    files: oversized,
};

console.log(JSON.stringify(result, null, 2));
