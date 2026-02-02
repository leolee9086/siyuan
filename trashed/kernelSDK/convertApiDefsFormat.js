import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DEFS_DIR = join(__dirname, 'apiDefs');

async function convertFileFormat(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');
    
    // 正则表达式匹配 export const xxx = [ ... ];
    // 它会捕获变量名 (like systemApiDefs) 和数组内容 (the stringified array)
    const exportRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*(\[[\s\S]*?\]);/s;
    const match = content.match(exportRegex);

    if (!match) {
      console.log(`Skipping ${filePath}: No matching export statement found.`);
      return false;
    }

    const variableName = match[1];
    const arrayString = match[2];
    let apiArray;

    try {
      // 尝试直接解析数组字符串。这需要数组是严格的 JSON 格式，或者用更宽松的解析器
      // 为了简单和安全，这里假设它接近JS数组字面量，但eval有风险，所以我们用一种变通方法
      // 我们期望的是一个JS数组，而不是JSON数组，所以JSON.parse可能不适用。
      // 一个更安全的方法是找到数组的起始和结束括号，然后处理内部的每一项。
      // 但鉴于我们之前的文件格式，可以尝试用 Function 构造器来安全地评估它。
      apiArray = new Function(`return ${arrayString};`)();
    } catch (e) {
      console.warn(`Skipping ${filePath}: Could not parse the array content. Error: ${e.message}`);
      return false;
    }

    if (!Array.isArray(apiArray) || apiArray.length === 0) {
      console.log(`Skipping ${filePath}: Not an array or empty array.`);
      return false;
    }

    // 检查第一项是否是数组，来判断是否是旧格式
    if (!Array.isArray(apiArray[0])) {
      console.log(`Skipping ${filePath}: Already in new object format or unknown format.`);
      return false;
    }

    const newApiArray = apiArray.map(item => {
      if (Array.isArray(item) && item.length >= 3) {
        return {
          method: item[0],
          endpoint: item[1],
          en: item[2],
          zh_cn: item[3], // 如果 item[3] 是 undefined, 这里也会是 undefined
        };
      }
      return item; // 如果某一项不是预期的数组格式，则原样保留（尽管这不应该发生）
    });

    // 构建新的文件内容
    // 注意：这里会丢失原始文件中的非数组定义部分代码和大部分注释（除非注释在数组字符串内部）
    // 但根据我们目前 apiDefs 文件的结构，主要是 export const ... = [...];
    let newContent = `export const ${variableName} = ${JSON.stringify(newApiArray, null, 2)};`;
    
    // 为了保持JS对象的格式而不是严格的JSON字符串键，我们做一些替换
    // 例如 "method": -> method:
    newContent = newContent.replace(/"([a-zA-Z0-9_]+)":/g, "$1:");
    // 将 undefined 字符串变回真正的 undefined
    newContent = newContent.replace(/"zh_cn": "undefined"/g, 'zh_cn: undefined');

    await writeFile(filePath, newContent, 'utf8');
    console.log(`Successfully converted ${filePath} to new object format.`);
    return true;

  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

async function main() {
  try {
    const files = await readdir(API_DEFS_DIR);
    let convertedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = join(API_DEFS_DIR, file);
        const result = await convertFileFormat(filePath);
        if (result) {
          convertedCount++;
        } else {
          skippedCount++;
        }
      }
    }
    console.log(`\nConversion complete. ${convertedCount} file(s) converted, ${skippedCount} file(s) skipped.`);
  } catch (error) {
    console.error('Error reading apiDefs directory:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Script execution failed:', err);
  process.exit(1);
});
