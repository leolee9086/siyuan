/**
 * listRouter 日志工具
 * 
 * 本文件提供详细的命令执行日志功能
 * 在 verbose 模式下输出极其详细的执行信息
 */

import * as dayjs from "dayjs";
import { LogLevel, type ListCommand, type CommandLogParams } from "./types";

/**
 * 全局日志级别配置
 * 默认为 VERBOSE 模式
 */
let currentLogLevel: LogLevel = LogLevel.VERBOSE;

/**
 * 修饰键常量
 * 用于格式化快捷键组合
 */
const MODIFIER_KEYS = ["Control", "Alt", "Shift", "Meta"] as const;

/**
 * 设置日志级别
 * 
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅修改内存中的配置变量，无需异步操作
 * 2. 需要立即生效，避免日志级别切换延迟
 * 3. 作为配置函数，同步调用更符合使用习惯
 * 
 * @param level - 要设置的日志级别
 */
export const setLogLevel = (level: LogLevel): void => {
    currentLogLevel = level;
};

/**
 * 获取当前日志级别
 * 
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅读取内存中的配置变量，无需异步操作
 * 2. 需要立即返回结果，避免日志判断延迟
 * 3. 作为配置读取函数，同步调用更符合使用习惯
 * 
 * @returns 当前的日志级别
 */
export const getLogLevel = (): LogLevel => {
    return currentLogLevel;
};

/**
 * 格式化快捷键组合
 * 
 * 将键盘事件转换为可读的快捷键字符串
 * 
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取事件对象的属性（ctrlKey, altKey等）
 * 2. 事件对象在异步操作后可能失效
 * 3. 作为日志格式化函数，必须在事件处理的同一帧内完成
 * 
 * @param event - 键盘事件对象
 * @returns 格式化的快捷键字符串，如 "Ctrl+Enter"
 */
const formatHotkey = (event: KeyboardEvent): string => {
    const parts: string[] = [];
    
    if (event.ctrlKey) {
        parts.push("Ctrl");
    }
    if (event.altKey) {
        parts.push("Alt");
    }
    if (event.shiftKey) {
        parts.push("Shift");
    }
    if (event.metaKey) {
        parts.push("Meta");
    }
    
    // 添加主键（排除修饰键本身）
    const key = event.key;
    // @内联数组
    if (key && !["Control", "Alt", "Shift", "Meta"].includes(key)) {
        parts.push(key);
    }
    
    return parts.join("+");
};

/**
 * 获取块类型的中文描述
 * 
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 DOM 元素的属性
 * 2. DOM 元素在异步操作后可能失效或被修改
 * 3. 作为日志格式化函数，必须在事件处理的同一帧内完成
 * 
 * @param nodeElement - 块元素
 * @returns 块类型的中文描述
 */
const getBlockTypeDescription = (nodeElement: HTMLElement): string => {
    const dataType = nodeElement.getAttribute("data-type");
    const dataSubtype = nodeElement.getAttribute("data-subtype");
    
    const typeMap: Record<string, string> = {
        "NodeParagraph": "段落",
        "NodeHeading": "标题",
        "NodeList": "列表项",
        "NodeCodeBlock": "代码块",
        "NodeTable": "表格",
        "NodeBlockquote": "引用块",
        "NodeSuperBlock": "超级块",
        "NodeMathBlock": "数学公式块",
        "NodeHTMLBlock": "HTML块"
    };
    
    const subtypeMap: Record<string, string> = {
        "u": "无序列表项",
        "o": "有序列表项",
        "t": "任务列表项"
    };
    
    let description = typeMap[dataType || ""] || dataType || "未知类型";
    
    // 如果有子类型且在映射表中，使用更具体的描述
    if (dataSubtype && subtypeMap[dataSubtype]) {
        description = subtypeMap[dataSubtype];
    }
    
    return description;
};

/**
 * 获取命令的中文描述
 * 
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅进行简单的字符串映射，无需异步操作
 * 2. 作为日志格式化函数，需要立即返回结果
 * 3. 在事件处理流程中调用，必须同步完成
 * 
 * @param command - 命令标识符
 * @returns 命令的中文描述
 */
const getCommandDescription = (command: ListCommand): string => {
    const commandMap: Record<ListCommand, string> = {
        "CHECK_TOGGLE": "TOGGLE_TASK_STATUS",
        "OUTDENT": "LIST_OUTDENT",
        "INDENT": "LIST_INDENT",
        "TRANSFORM_TO_UL": "TRANSFORM_TO_UNORDERED_LIST",
        "TRANSFORM_TO_OL": "TRANSFORM_TO_ORDERED_LIST",
        "TRANSFORM_TO_TL": "TRANSFORM_TO_TASK_LIST",
        "TRANSFORM_TO_QUOTE": "TRANSFORM_TO_QUOTE",
        "IGNORE": "IGNORE"
    };
    
    return commandMap[command] || command;
};

/**
 * 获取任务状态的中文描述
 * 
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅进行简单的布尔值映射，无需异步操作
 * 2. 作为日志格式化函数，需要立即返回结果
 * 3. 在事件处理流程中调用，必须同步完成
 * 
 * @param isDone - 任务是否完成
 * @returns 任务状态的中文描述
 */
const getTaskStatusDescription = (isDone: boolean): string => {
    return isDone ? "已完成" : "未完成";
};

/**
 * 从堆栈信息中提取文件路径
 *
 * 支持多种堆栈格式：
 * - 标准文件路径格式（开发环境）
 * - webpack-internal 格式（webpack 开发模式）
 * - 生产环境打包后的格式
 *
 * @同步豁免: 性能考虑
 * 此函数必须同步执行，因为：
 * 1. 仅进行字符串解析，无需异步操作
 * 2. 作为日志格式化函数，需要立即返回结果
 * 3. 在事件处理流程中调用，必须同步完成
 *
 * @returns 文件路径信息
 */
const extractCallerInfo = (): string => {
    const stack = new Error().stack || "";
    const lines = stack.split("\n");
    
    // 跳过前几行（Error、extractCallerInfo、logCommandExecution/logTaskToggle）
    // 找到实际调用日志的位置
    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
            continue;
        }
        
        // 格式1: webpack-internal 格式 - at functionName (webpack-internal:///./src/path/file.ts:line:col)
        let match = line.match(/at\s+\w+\s+\(webpack-internal:\/\/\/\.\/src\/(.+?\.ts):\d+:\d+\)/);
        // 匹配成功且捕获组1存在时，说明找到了 webpack-internal 格式的文件路径
        if (match && match[1]) {
            return `src/${match[1]}`;
        }
        
        // 格式2: webpack-internal 格式（无函数名） - at webpack-internal:///./src/path/file.ts:line:col
        match = line.match(/at\s+webpack-internal:\/\/\/\.\/src\/(.+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了 webpack-internal 格式的文件路径（无函数名变体）
        if (match && match[1]) {
            return `src/${match[1]}`;
        }
        
        // 格式3: 标准格式 - at functionName (path:line:col)
        match = line.match(/at\s+\w+\s+\(.*[/\\](app[/\\]src[/\\].+?\.ts):\d+:\d+\)/);
        // 匹配成功且捕获组1存在时，说明找到了标准格式的文件路径（带函数名）
        if (match && match[1]) {
            const filePath = match[1];
            return filePath.replace(/\\/g, "/");
        }
        
        // 格式4: 标准格式（无函数名） - at path:line:col
        match = line.match(/at\s+.*[/\\](app[/\\]src[/\\].+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了标准格式的文件路径（无函数名）
        if (match && match[1]) {
            const filePath = match[1];
            return filePath.replace(/\\/g, "/");
        }
        
        // 格式5: Firefox - functionName@path:line:col
        match = line.match(/@.*[/\\](app[/\\]src[/\\].+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了 Firefox 格式的文件路径
        if (match && match[1]) {
            const filePath = match[1];
            return filePath.replace(/\\/g, "/");
        }
        
        // 格式6: Firefox webpack-internal - functionName@webpack-internal:///./src/path/file.ts:line:col
        match = line.match(/@webpack-internal:\/\/\/\.\/src\/(.+?\.ts):\d+:\d+/);
        // 匹配成功且捕获组1存在时，说明找到了 Firefox 下 webpack-internal 格式的文件路径
        if (match && match[1]) {
            return `src/${match[1]}`;
        }
    }
    
    // 如果所有格式都匹配失败，返回默认值（不输出警告，避免日志污染）
    return "未知文件";
};

/**
 * 记录命令执行日志
 *
 * 根据日志级别输出不同详细程度的日志信息
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 DOM 元素和事件对象的属性
 * 2. 这些对象在异步操作后可能失效
 * 3. 日志记录必须在事件处理的同一帧内完成，确保信息准确
 * 4. console.log 本身是同步操作
 *
 * @param params - 日志参数
 */
export const logCommandExecution = (params: CommandLogParams): void => {
    const { command, event, nodeElement, result, context } = params;
    
    // 简洁模式：只输出基本信息
    if (currentLogLevel === LogLevel.SIMPLE) {
        console.log(`[列表操作] ${getCommandDescription(command)}`);
        return;
    }
    
    // VERBOSE 模式：输出详细信息
    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS");
    const blockId = nodeElement.getAttribute("data-node-id") || "未知";
    const blockType = getBlockTypeDescription(nodeElement);
    const hotkey = formatHotkey(event);
    const commandDesc = getCommandDescription(command);
    const filePath = extractCallerInfo();
    
    // 构建日志消息
    let logMessage = `[${timestamp}] 用户在块 ${blockId} (${blockType}) 中按下 ${hotkey}，` +
                     `执行了 ${filePath} 中的 ${commandDesc} 命令`;
    
    // 添加执行结果
    if (result) {
        logMessage += `，${result}`;
    }
    
    console.log(logMessage);
    
    // 如果有额外的上下文信息，也输出
    if (context && Object.keys(context).length > 0) {
        console.log("  上下文信息:", context);
    }
};

/**
 * 记录任务状态切换日志
 * 
 * 专门用于任务列表状态切换的日志记录
 * 
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 调用 logCommandExecution，后者需要同步执行
 * 2. 需要在事件处理的同一帧内完成日志记录
 * 3. 确保日志信息的准确性和时序性
 * 
 * @param params - 日志参数
 * @param oldStatus - 切换前的状态
 * @param newStatus - 切换后的状态
 */
export const logTaskToggle = (
    params: Omit<CommandLogParams, "result">,
    oldStatus: boolean,
    newStatus: boolean
): void => {
    const oldStatusDesc = getTaskStatusDescription(oldStatus);
    const newStatusDesc = getTaskStatusDescription(newStatus);
    const result = `状态已从 ${oldStatusDesc} 切换为 ${newStatusDesc}`;
    
    logCommandExecution({
        ...params,
        result
    });
};
