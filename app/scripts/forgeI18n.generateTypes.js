#!/usr/bin/env node

/**
 * 从多语言集中格式的 JSON 文件生成 TypeScript 类型定义的脚本
 * 用于 Forge 项目的国际化
 * 
 * 源文件格式示例：
 * {
 *   "书签面板": {
 *     "标题": {
 *       "zh_CN": "书签",
 *       "en_US": "Bookmark"
 *     }
 *   }
 * }
 * 
 * 生成的类型定义基于 zh_CN 作为主语言
 */

const fs = require("fs");
const path = require("path");

// 默认配置
const DEFAULT_CONFIG = {
    inputFile: path.resolve(__dirname, "../appearance/langs/forge.i18n.json"),
    outputFile: path.resolve(__dirname, "../src/types/forgeI18n.types.ts"),
    typeName: "ForgeI18nKeys",
    rootInterfaceName: "ForgeI18n",
    language: "zh_CN"
};

// 运行时配置
let runtimeConfig = { ...DEFAULT_CONFIG };

/**
 * 解析命令行参数
 */
function parseCliArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case "-i":
            case "--input":
                options.input = args[++i];
                break;
            case "-o":
            case "--output":
                options.output = args[++i];
                break;
            case "-l":
            case "--language":
                options.language = args[++i];
                break;
            case "-n":
            case "--name":
                options.rootInterfaceName = args[++i];
                break;
            case "-h":
            case "--help":
                options.help = true;
                break;
            default:
                if (arg.startsWith("-")) {
                    console.error(`未知参数: ${arg}`);
                    options.help = true;
                }
        }
    }

    return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
用法: node forgeI18n.generateTypes.js [选项]

选项:
  -i, --input <path>     输入的多语言 JSON 文件路径 (默认: ${DEFAULT_CONFIG.inputFile})
  -o, --output <path>    输出的 TypeScript 文件路径 (默认: ${DEFAULT_CONFIG.outputFile})
  -l, --language <lang>  指定主语言代码，用于生成类型 (默认: ${DEFAULT_CONFIG.language})
  -n, --name <name>      指定根接口名称 (默认: ${DEFAULT_CONFIG.rootInterfaceName})
  -h, --help            显示帮助信息

示例:
  node forgeI18n.generateTypes.js
  node forgeI18n.generateTypes.js -l en_US
`);
}

/**
 * 转换键名为有效的 TypeScript 属性名
 */
function toValidPropertyName(key) {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
        return `'${key.replace(/'/g, "\\'")}'`;
    }
    return key;
}

/**
 * 检查对象是否是语言对象（包含 zh_CN、en_US 等键）
 */
function isLanguageObject(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    const keys = Object.keys(obj);
    // 检查是否所有键都匹配语言代码格式（如 zh_CN, en_US）
    return keys.length > 0 && keys.every(key => /^[a-z]{2}_[A-Z]{2}$/.test(key));
}

/**
 * 从多语言对象中提取指定语言的值
 */
function extractLanguageValue(obj, language) {
    if (isLanguageObject(obj)) {
        return obj[language] || obj["zh_CN"] || Object.values(obj)[0];
    }

    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = extractLanguageValue(value, language);
        }
        return result;
    }

    return obj;
}

/**
 * 生成嵌套对象的类型定义
 */
function generateNestedType(obj, indent = 0) {
    const spaces = "  ".repeat(indent);
    const entries = [];

    for (const [key, value] of Object.entries(obj)) {
        const validKey = toValidPropertyName(key);

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            const nestedType = generateNestedType(value, indent + 1);
            entries.push(`${spaces}${validKey}: ${nestedType};`);
        } else {
            const escapedValue = String(value)
                .replace(/\$/g, "\\$")
                .replace(/\{/g, "\\{")
                .replace(/\}/g, "\\}");
            entries.push(`${spaces}${validKey}: \`${escapedValue}\``);
        }
    }

    if (entries.length === 0) {
        return `${spaces}{}`;
    }

    return `{\n${entries.join("\n")}\n${spaces}}`;
}

/**
 * 生成完整的 TypeScript 类型定义
 */
function generateTypeDefinition(jsonData, language) {
    const header = `/**
 * 自动生成的 Forge 国际化类型定义
 * 请勿手动修改此文件，重新生成会覆盖更改
 * 生成时间: ${new Date().toISOString()}
 * 主语言: ${language}
 */

`;

    const mainInterface = `export interface ${runtimeConfig.rootInterfaceName} ${generateNestedType(jsonData)}`;
    const typeAlias = `export type ${runtimeConfig.typeName} = ${runtimeConfig.rootInterfaceName}[keyof ${runtimeConfig.rootInterfaceName}]`;

    return header + mainInterface + "\n\n" + typeAlias + "\n";
}

/**
 * 主函数
 */
async function main() {
    try {
        const options = parseCliArgs();

        if (options.help) {
            showHelp();
            process.exit(0);
        }

        const language = options.language || DEFAULT_CONFIG.language;
        const inputFile = options.input ? path.resolve(options.input) : DEFAULT_CONFIG.inputFile;
        const outputFile = options.output ? path.resolve(options.output) : DEFAULT_CONFIG.outputFile;

        runtimeConfig = {
            ...DEFAULT_CONFIG,
            language,
            inputFile,
            outputFile,
            rootInterfaceName: options.rootInterfaceName || DEFAULT_CONFIG.rootInterfaceName,
            typeName: options.rootInterfaceName
                ? `${options.rootInterfaceName}Keys`
                : DEFAULT_CONFIG.typeName
        };

        console.log(`生成接口名称: ${runtimeConfig.rootInterfaceName}`);
        console.log(`主语言: ${language}`);
        console.log(`正在读取文件: ${inputFile}`);

        if (!fs.existsSync(inputFile)) {
            console.error(`错误: 输入文件不存在: ${inputFile}`);
            process.exit(1);
        }

        const jsonContent = fs.readFileSync(inputFile, "utf-8");
        const multiLangData = JSON.parse(jsonContent);

        // 提取指定语言的翻译
        console.log(`正在提取 ${language} 语言的翻译...`);
        const langData = extractLanguageValue(multiLangData, language);

        console.log(`已解析 ${Object.keys(langData).length} 个顶级键`);
        console.log(`输出文件: ${outputFile}`);

        console.log("正在生成类型定义...");
        const typeDefinition = generateTypeDefinition(langData, language);

        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputFile, typeDefinition, "utf-8");
        console.log(`类型定义已生成到: ${outputFile}`);

        console.log("完成！");
    } catch (error) {
        console.error("错误:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, generateTypeDefinition, extractLanguageValue, parseCliArgs };
