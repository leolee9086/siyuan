/**
 * executor 辅助函数模块
 * 包含从 SecureModuleCreator 类中提取的纯函数
 */
import { parse } from "es-module-lexer";
import type MagicString from "magic-string";
import type { UnauthorizedImportStrategy, ImportSpec, TemporaryModule } from "./executor.types";
import { isElectron } from "../../../platform";

/**
 * 判断是否为外部包
 */
export function 判断是否为外部包(importSource: string): boolean {
    return !importSource.startsWith(".") &&
        !importSource.startsWith("/") &&
        !importSource.startsWith("http:") &&
        !importSource.startsWith("https:");
}

/**
 * 提取包名
 */
export function 提取包名(importSource: string): string {
    // 移除查询参数和哈希
    const withoutQuery = importSource.split("?")[0] ?? "";
    const cleanSource = withoutQuery.split("#")[0] ?? "";

    if (!cleanSource.startsWith("@")) {
        // 对于普通包名，返回完整的导入路径（包括子路径）
        // 这样可以正确处理如 'echarts/lib/util/graphic' 这样的导入
        return cleanSource;
    }

    const parts = cleanSource.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : cleanSource;
}

/**
 * 创建默认模拟对象
 */
export function 创建默认模拟对象(packageName: string): string {
    return `/* Mock ${packageName} */ (() => {
      console.warn('Package ${packageName} was mocked for security reasons');
      return {};
    })()`;
}

/** 策略处理器映射 */
const 策略处理器表: Record<
    UnauthorizedImportStrategy,
    (params: {
        magicString: MagicString;
        s: number;
        e: number;
        packageName: string;
        customMocks: Record<string, string>;
    }) => void
> = {
    throw: () => {
        // 对于 'throw' 策略，不替换导入语句，保留原导入语句
        // 错误将在代码开头统一添加
    },
    mock: ({ magicString, s, e, packageName, customMocks }) => {
        const mockCode = customMocks[packageName] ?? 创建默认模拟对象(packageName);
        magicString.overwrite(s, e, mockCode);
    },
    remove: ({ magicString, s, e }) => {
        // 移除整个导入语句
        const lineEnd = magicString.original.indexOf("\n", e);
        const removeEnd = lineEnd !== -1 ? lineEnd + 1 : e;
        magicString.remove(s, removeEnd);
    }
};

/**
 * 根据策略处理导入
 */
export function 根据策略处理导入(
    magicString: MagicString,
    importSpec: ImportSpec,
    packageName: string,
    strategy: UnauthorizedImportStrategy,
    customMocks: Record<string, string>
): void {
    const { s, e } = importSpec;
    const handler = 策略处理器表[strategy];

    if (!handler) {
        throw new Error(`未知策略: ${strategy}`);
    }

    handler({ magicString, s, e, packageName, customMocks });
}

/**
 * 从代码中提取包名
 */
export function 从代码中提取包名(code: string): string[] {
    const packageNames: string[] = [];
    const imports = parse(code)[0] ?? [];

    for (const importSpec of imports) {
        const importSource = code.substring(importSpec.s, importSpec.e);

        if (!判断是否为外部包(importSource)) {
            continue;
        }

        const packageName = 提取包名(importSource);
        packageNames.push(packageName);
    }

    return packageNames;
}

/**
 * 在浏览器环境中创建临时模块
 */
export async function 创建浏览器临时模块(code: string): Promise<TemporaryModule> {
    // 创建 Blob URL
    const blob = new Blob([code], { type: "application/javascript" });
    const moduleUrl = URL.createObjectURL(blob);

    try {
        const moduleExport = await import(/* webpackIgnore: true */ moduleUrl);
        // 返回模块信息和清理函数
        console.log(moduleExport);
        return {
            moduleUrl,
            moduleExport: moduleExport,
            cleanup: () => {
                URL.revokeObjectURL(moduleUrl);
            },
            hasError: false
        };
    } catch (error) {
        // 如果导入失败，清理URL并返回包含错误信息的结果
        URL.revokeObjectURL(moduleUrl);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            moduleUrl,
            moduleExport: null,
            cleanup: () => {
                // 空清理函数，因为URL已经被清理
            },
            error: errorMessage,
            hasError: true
        };
    }
}

/**
 * 在 Node.js 环境中创建临时模块（仅 Electron 环境可用）
 */
export async function 创建NodeJS临时模块(code: string): Promise<TemporaryModule> {
    if (!isElectron) {
        throw new Error("创建NodeJS临时模块 is not available in browser environment");
    }
    const { writeFileSync, mkdirSync } = await import(/* webpackIgnore: true */ "fs");
    const { join } = await import(/* webpackIgnore: true */ "path");
    const { tmpdir } = await import(/* webpackIgnore: true */ "os");
    const { createHash } = await import(/* webpackIgnore: true */ "crypto");

    // 创建临时目录
    const tempDir = join(tmpdir(), "secure-modules");
    try {
        mkdirSync(tempDir, { recursive: true });
    } catch {
        // 目录可能已存在，忽略错误
    }

    // 从代码中提取包名，用于生成哈希
    const packageNames = 从代码中提取包名(code);
    const packageHash = packageNames.length > 0
        ? createHash("md5").update(packageNames.join(",")).digest("hex").substring(0, 8)
        : createHash("md5").update(code).digest("hex").substring(0, 8);

    // 创建临时文件，使用包名相关的哈希
    const fileName = `module-${packageHash}-${Date.now()}.js`;
    const filePath = join(tempDir, fileName);

    try {
        // 写入代码到临时文件
        writeFileSync(filePath, code, "utf8");
        console.log(filePath, code);
        // 使用动态 import 导入模块
        const moduleUrl = `${filePath}`;
        const moduleExport = await import(/* webpackIgnore: true */moduleUrl);

        // 返回模块信息和清理函数
        return {
            moduleUrl,
            moduleExport: moduleExport,
            cleanup: () => {
                // 不删除文件，让测试可以读取
            },
            hasError: false
        };

    } catch (error) {
        // 如果失败，清理文件并返回包含错误信息的结果
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            moduleUrl: filePath,
            moduleExport: null,
            cleanup: () => {
                // 不删除文件，让测试可以读取
            },
            error: errorMessage,
            hasError: true
        };
    }
}

/** 检查是否为 Node.js 环境（用于环境检测） */
function 检测NodeJS环境(): boolean {
    // @环境检测: 需要检测 window 来区分浏览器和 Node.js 环境
     
    return typeof window === "undefined" && typeof process !== "undefined";
}

/**
 * 创建临时模块（根据环境选择合适的方法）
 */
export async function 创建临时模块(code: string): Promise<TemporaryModule> {
    // 检查是否在 Node.js 环境中
    const isNodeJS = 检测NodeJS环境();

    if (!isNodeJS) {
        // 浏览器环境下的处理
        return 创建浏览器临时模块(code);
    }

    // Node.js 环境下的特殊处理
    return 创建NodeJS临时模块(code);
}
