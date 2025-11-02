#!/usr/bin/env node

/**
 * 从 zh_CN.json 生成 TypeScript 类型定义的脚本
 * 用于为思源笔记的国际化提供类型安全
 */

const fs = require('fs');
const path = require('path');

// 默认配置
const DEFAULT_CONFIG = {
  inputFile: path.resolve(__dirname, '../appearance/langs/zh_CN.json'),
  outputFile: path.resolve(__dirname, '../src/types/i18n.types.ts'),
  typeName: 'I18nKeys',
  rootInterfaceName: 'SiYuanI18n'
};

/**
 * 命令行参数接口
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-i':
      case '--input':
        options.input = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
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
用法: node i18n.generateTypes.js [选项]

选项:
  -i, --input <path>   输入的 JSON 文件路径 (默认: ${DEFAULT_CONFIG.inputFile})
  -o, --output <path>  输出的 TypeScript 文件路径 (默认: ${DEFAULT_CONFIG.outputFile})
  -h, --help           显示帮助信息

示例:
  node i18n.generateTypes.js
  node i18n.generateTypes.js -i ./zh_CN.json -o ./i18n.types.ts
`);
}

/**
 * 转换键名为有效的 TypeScript 属性名
 */
function toValidPropertyName(key) {
  // 如果键名包含特殊字符，用引号包裹
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return `'${key.replace(/'/g, "\\'")}'`;
  }
  return key;
}

/**
 * 生成嵌套对象的类型定义
 */
function generateNestedType(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  const entries = [];

  for (const [key, value] of Object.entries(obj)) {
    const validKey = toValidPropertyName(key);
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 嵌套对象
      const nestedType = generateNestedType(value, indent + 1);
      entries.push(`${spaces}${validKey}: ${nestedType};`);
    } else {
      // 基本类型值
      entries.push(`${spaces}${validKey}: string;`);
    }
  }

  if (entries.length === 0) {
    return `${spaces}{}`;
  }

  return `{\n${entries.join('\n')}\n${spaces}}`;
}

/**
 * 生成完整的 TypeScript 类型定义
 */
function generateTypeDefinition(jsonData) {
  const header = `/**
 * 自动生成的思源笔记国际化类型定义
 * 请勿手动修改此文件，重新生成会覆盖更改
 * 生成时间: ${new Date().toISOString()}
 */

`;

  // 生成主接口
  const mainInterface = `export interface ${DEFAULT_CONFIG.rootInterfaceName} ${generateNestedType(jsonData)}`;

  // 生成类型别名，用于直接访问
  const typeAlias = `export type ${DEFAULT_CONFIG.typeName} = ${DEFAULT_CONFIG.rootInterfaceName}[keyof ${DEFAULT_CONFIG.rootInterfaceName}]`;

  // 生成特殊键的类型
  const specialKeys = Object.keys(jsonData).filter(key => key.startsWith('_'));
  let specialKeysTypes = '';

  if (specialKeys.length > 0) {
    specialKeysTypes = '\n\n// 特殊键的类型定义\n';
    for (const key of specialKeys) {
      const value = jsonData[key];
      const validKey = toValidPropertyName(key);
      const typeName = key.replace(/^_/, '').replace(/^[a-z]/, c => c.toUpperCase());
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        specialKeysTypes += `export interface ${typeName} ${generateNestedType(value)}\n\n`;
      }
    }
  }

  return header + mainInterface + '\n\n' + typeAlias + specialKeysTypes;
}

/**
 * 主函数
 */
async function main() {
  try {
    // 解析命令行参数
    const options = parseCliArgs();
    
    // 显示帮助信息
    if (options.help) {
      showHelp();
      process.exit(0);
    }

    // 确定输入输出路径
    const inputFile = options.input ? path.resolve(options.input) : DEFAULT_CONFIG.inputFile;
    const outputFile = options.output ? path.resolve(options.output) : DEFAULT_CONFIG.outputFile;

    console.log(`正在读取文件: ${inputFile}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(inputFile)) {
      console.error(`错误: 输入文件不存在: ${inputFile}`);
      process.exit(1);
    }
    
    // 读取 JSON 文件
    const jsonContent = fs.readFileSync(inputFile, 'utf-8');
    const jsonData = JSON.parse(jsonContent);

    console.log(`已解析 ${Object.keys(jsonData).length} 个顶级键`);
    console.log(`输出文件: ${outputFile}`);
    
    // 生成类型定义
    console.log('正在生成类型定义...');
    const typeDefinition = generateTypeDefinition(jsonData);

    // 确保输出目录存在
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入类型定义文件
    fs.writeFileSync(outputFile, typeDefinition, 'utf-8');
    console.log(`类型定义已生成到: ${outputFile}`);
    
    console.log('完成！');
  } catch (error) {
    console.error('错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行主函数
if (require.main === module) {
  main();
}

module.exports = { main, generateTypeDefinition, parseCliArgs };