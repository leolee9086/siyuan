#!/usr/bin/env node

/**
 * migrate-files.mjs
 * 批量移动 TypeScript 文件并自动更新全项目 import 路径的迁移脚本。
 *
 * 用法：
 *   node scripts/migrate-files.mjs <config.json> [--dry-run]
 *
 * 配置文件格式：
 * {
 *   "moves": [
 *     { "from": "src/util/fetch.ts", "to": "src/util/network/fetch.ts" }
 *   ]
 * }
 *
 * 路径相对于 app/ 目录。脚本应从 app/ 目录运行。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative, extname, posix } from "node:path";
import { execSync } from "node:child_process";

// ─── CLI 参数解析 ───

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const configPath = args.find(a => !a.startsWith("--"));

if (!configPath) {
    console.error("用法: node scripts/migrate-files.mjs <config.json> [--dry-run]");
    process.exit(1);
}

// ─── 路径工具 ───

/** 将 Windows 反斜杠路径转为 posix 风格 */
function toPosix(p) {
    return p.split("\\").join("/");
}

/** 递归收集目录下所有 .ts 文件（排除 node_modules 和 .git） */
function collectTsFiles(dir) {
    const results = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === ".git") continue;
            results.push(...collectTsFiles(fullPath));
        } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * 计算从 fromFile 到 toModule 的相对 import 路径（posix 风格，不带扩展名）。
 * @param {string} fromFile - 引用方文件的绝对路径
 * @param {string} toModule - 被引用模块的绝对路径
 * @returns {string} 相对路径，如 "./network/fetch" 或 "../utils/helper"
 */
function calcRelativeImport(fromFile, toModule) {
    const fromDir = dirname(fromFile);
    let rel = toPosix(relative(fromDir, toModule));
    // 去掉 .ts / .tsx 扩展名
    rel = rel.replace(/\.tsx?$/, "");
    // 确保以 ./ 或 ../ 开头
    if (!rel.startsWith(".")) {
        rel = "./" + rel;
    }
    return rel;
}

// ─── Import 语句匹配 ───

/**
 * 匹配文件中所有 import/export/动态import 语句中的模块路径。
 * 返回匹配数组，每项包含 { fullMatch, quote, specifier, index }。
 *
 * 覆盖的模式：
 * - import ... from "..."
 * - import type ... from "..."
 * - export { ... } from "..."
 * - export type { ... } from "..."
 * - import("...")
 * - require("...")
 */
const IMPORT_PATTERN = /(?:(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+)?from\s+|(import|require)\s*\(\s*)(["'])([^"']+)\2/g;

/**
 * 判断一个 import specifier 是否指向目标模块。
 * @param {string} specifier - import 语句中的路径，如 "../fetch" 或 "./fetch.ts"
 * @param {string} importerAbsPath - 当前文件的绝对路径
 * @param {string} targetAbsPath - 目标模块的绝对路径（旧位置）
 * @returns {boolean}
 */
function specifierMatchesTarget(specifier, importerAbsPath, targetAbsPath) {
    // 只处理相对路径
    if (!specifier.startsWith(".")) return false;

    const importerDir = dirname(importerAbsPath);
    // 尝试直接解析
    const resolved = resolve(importerDir, specifier);
    const resolvedPosix = toPosix(resolved);
    const targetPosix = toPosix(targetAbsPath);

    // 精确匹配（带扩展名）
    if (resolvedPosix === targetPosix) return true;

    // 不带扩展名匹配：给 specifier 加上 .ts / .tsx 再比较
    const targetNoExt = targetPosix.replace(/\.tsx?$/, "");
    const resolvedNoExt = resolvedPosix.replace(/\.tsx?$/, "");
    if (resolvedNoExt === targetNoExt) return true;

    return false;
}

// ─── 主逻辑 ───

function main() {
    const appDir = process.cwd();
    const repoRoot = resolve(appDir, "..");

    // 读取配置
    const configAbsPath = resolve(appDir, configPath);
    if (!existsSync(configAbsPath)) {
        console.error(`配置文件不存在: ${configPath}`);
        process.exit(1);
    }
    const config = JSON.parse(readFileSync(configAbsPath, "utf-8"));
    const moves = config.moves;
    if (!Array.isArray(moves) || moves.length === 0) {
        console.error("配置文件中没有有效的 moves 条目");
        process.exit(1);
    }

    console.log(`\n📦 文件迁移脚本${dryRun ? " [DRY-RUN 模式]" : ""}`);
    console.log(`   配置: ${configPath}`);
    console.log(`   移动项: ${moves.length} 个\n`);

    // 收集 app/src 下所有 .ts 文件
    const srcDir = resolve(appDir, "src");
    const allTsFiles = collectTsFiles(srcDir);
    console.log(`   扫描到 ${allTsFiles.length} 个 .ts/.tsx 文件\n`);

    // 构建移动映射：旧绝对路径 -> 新绝对路径
    const moveMap = new Map();
    for (const move of moves) {
        const fromAbs = resolve(appDir, move.from);
        const toAbs = resolve(appDir, move.to);
        moveMap.set(toPosix(fromAbs), toPosix(toAbs));
    }

    // 阶段1：执行文件移动
    console.log("═══ 阶段1: 移动文件 ═══\n");
    const successfulMoves = [];

    for (const move of moves) {
        const fromAbs = resolve(appDir, move.from);
        const toAbs = resolve(appDir, move.to);

        console.log(`  ${move.from} → ${move.to}`);

        // 检查源文件
        if (!existsSync(fromAbs)) {
            console.log(`    ⚠️  跳过: 源文件不存在\n`);
            continue;
        }
        // 检查目标文件
        if (existsSync(toAbs)) {
            console.log(`    ⚠️  跳过: 目标文件已存在\n`);
            continue;
        }

        // 创建目标目录
        const toDir = dirname(toAbs);
        if (!existsSync(toDir)) {
            if (dryRun) {
                console.log(`    📁 将创建目录: ${toPosix(relative(appDir, toDir))}`);
            } else {
                mkdirSync(toDir, { recursive: true });
                console.log(`    📁 已创建目录: ${toPosix(relative(appDir, toDir))}`);
            }
        }

        // git mv（路径相对于仓库根目录）
        const gitFrom = toPosix(relative(repoRoot, fromAbs));
        const gitTo = toPosix(relative(repoRoot, toAbs));
        const gitCmd = `git mv "${gitFrom}" "${gitTo}"`;

        if (dryRun) {
            console.log(`    🔀 将执行: ${gitCmd}`);
        } else {
            try {
                execSync(gitCmd, { cwd: repoRoot, stdio: "pipe" });
                console.log(`    ✅ git mv 成功`);
            } catch (err) {
                console.error(`    ❌ git mv 失败: ${err.message}`);
                continue;
            }
        }

        successfulMoves.push({ from: fromAbs, to: toAbs, spec: move });
        console.log("");
    }

    if (successfulMoves.length === 0) {
        console.log("\n没有成功移动的文件，跳过 import 更新。\n");
        return;
    }

    // 阶段2：更新 import 路径
    console.log("═══ 阶段2: 更新 import 路径 ═══\n");

    // 在 dry-run 模式下，被移动文件仍在旧位置，需要特殊处理扫描列表
    // 在实际模式下，文件已移动到新位置
    let filesToScan;
    if (dryRun) {
        filesToScan = allTsFiles;
    } else {
        // 重新扫描，因为文件已移动
        filesToScan = collectTsFiles(srcDir);
    }

    let totalUpdatedFiles = 0;
    let totalUpdatedImports = 0;

    for (const tsFile of filesToScan) {
        const tsFilePosix = toPosix(tsFile);
        let content = readFileSync(tsFile, "utf-8");
        let fileUpdated = false;
        let fileUpdateCount = 0;

        // 确定当前文件的"有效位置"（dry-run 时被移动文件仍在旧位置）
        let effectiveFilePath = tsFilePosix;
        if (dryRun) {
            for (const mv of successfulMoves) {
                if (tsFilePosix === toPosix(mv.from)) {
                    effectiveFilePath = toPosix(mv.to);
                    break;
                }
            }
        }

        // 对每个移动项，检查当前文件是否引用了旧路径
        for (const mv of successfulMoves) {
            const oldPath = toPosix(mv.from);
            const newPath = toPosix(mv.to);

            // 被移动文件自身：需要重新计算其内部所有相对 import
            // 这在下面的通用逻辑中已处理（effectiveFilePath 已更新）

            const newContent = content.replace(IMPORT_PATTERN, (fullMatch, _dynKw, quote, specifier) => {
                // 判断这个 specifier 是否指向被移动的旧路径
                const importerForResolve = dryRun ? tsFile : tsFile;
                if (!specifierMatchesTarget(specifier, importerForResolve, mv.from)) {
                    return fullMatch;
                }

                // 计算新的相对路径
                const newRelative = calcRelativeImport(
                    effectiveFilePath.includes("\\") ? effectiveFilePath : effectiveFilePath,
                    newPath
                );

                // 保留原始是否带 .ts 扩展名的风格
                const hadExtension = /\.tsx?$/.test(specifier);
                let finalPath = newRelative;
                if (hadExtension) {
                    // 从新的绝对路径获取扩展名
                    finalPath = newRelative + extname(newPath);
                }

                fileUpdated = true;
                fileUpdateCount++;
                return fullMatch.replace(specifier, finalPath);
            });

            content = newContent;
        }

        // 如果是被移动的文件自身，还需要更新其内部所有相对 import（因为文件位置变了）
        if (!dryRun) {
            // 实际模式下，被移动文件已在新位置，上面的逻辑已经处理了指向其他被移动文件的引用
            // 但还需要处理指向未移动文件的引用
            for (const mv of successfulMoves) {
                if (tsFilePosix === toPosix(mv.to)) {
                    // 这个文件是被移动的文件，需要重新计算所有相对 import
                    const oldFilePath = toPosix(mv.from);
                    content = updateMovedFileImports(content, oldFilePath, tsFilePosix, moveMap);
                    fileUpdated = true;
                    break;
                }
            }
        } else {
            // dry-run 模式下，被移动文件仍在旧位置
            for (const mv of successfulMoves) {
                if (tsFilePosix === toPosix(mv.from)) {
                    const newFilePath = toPosix(mv.to);
                    content = updateMovedFileImports(content, tsFilePosix, newFilePath, moveMap);
                    fileUpdated = true;
                    break;
                }
            }
        }

        if (fileUpdated) {
            const relPath = toPosix(relative(appDir, tsFile));
            if (dryRun) {
                console.log(`  📝 将更新: ${relPath} (${fileUpdateCount} 处 import)`);
            } else {
                writeFileSync(tsFile, content, "utf-8");
                console.log(`  ✅ 已更新: ${relPath} (${fileUpdateCount} 处 import)`);
            }
            totalUpdatedFiles++;
            totalUpdatedImports += fileUpdateCount;
        }
    }

    console.log(`\n═══ 完成 ═══`);
    console.log(`  移动文件: ${successfulMoves.length} 个`);
    console.log(`  更新文件: ${totalUpdatedFiles} 个`);
    console.log(`  更新 import: ${totalUpdatedImports} 处\n`);
}

/**
 * 更新被移动文件内部的所有相对 import 路径。
 * 因为文件位置变了，所有相对路径都需要重新计算。
 *
 * @param {string} content - 文件内容
 * @param {string} oldAbsPath - 文件的旧绝对路径（posix）
 * @param {string} newAbsPath - 文件的新绝对路径（posix）
 * @param {Map<string, string>} moveMap - 所有移动映射（旧路径 -> 新路径）
 * @returns {string} 更新后的文件内容
 */
function updateMovedFileImports(content, oldAbsPath, newAbsPath, moveMap) {
    const oldDir = dirname(oldAbsPath);
    const newDir = dirname(newAbsPath);

    // 如果目录没变，不需要更新
    if (oldDir === newDir) return content;

    return content.replace(IMPORT_PATTERN, (fullMatch, _dynKw, quote, specifier) => {
        if (!specifier.startsWith(".")) return fullMatch;

        // 解析 specifier 指向的绝对路径（基于旧位置）
        const resolvedAbs = toPosix(resolve(oldDir, specifier));

        // 检查这个目标是否也被移动了
        let targetAbs = resolvedAbs;
        // 尝试匹配（带扩展名和不带扩展名）
        if (moveMap.has(targetAbs)) {
            targetAbs = moveMap.get(targetAbs);
        } else {
            // 尝试加 .ts
            const withTs = targetAbs + ".ts";
            if (moveMap.has(withTs)) {
                targetAbs = moveMap.get(withTs);
            } else {
                const withTsx = targetAbs + ".tsx";
                if (moveMap.has(withTsx)) {
                    targetAbs = moveMap.get(withTsx);
                }
                // 目标没被移动，保持原始解析路径（但需要基于新位置重新计算相对路径）
            }
        }

        // 基于新位置计算相对路径
        let newRel = toPosix(relative(newDir, targetAbs));
        // 去掉扩展名（如果原始 specifier 没有扩展名）
        const hadExtension = /\.tsx?$/.test(specifier);
        if (!hadExtension) {
            newRel = newRel.replace(/\.tsx?$/, "");
        }
        if (!newRel.startsWith(".")) {
            newRel = "./" + newRel;
        }

        if (newRel !== specifier) {
            return fullMatch.replace(specifier, newRel);
        }
        return fullMatch;
    });
}

main();
