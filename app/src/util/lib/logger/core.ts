/**
 * 核心日志功能模块
 * 
 * 本文件提供核心的日志记录功能，包括日志级别管理和主要的日志记录函数
 */

import * as dayjs from "dayjs";
import { LogLevel, type CommandLogParams } from "./types";
import { 
    formatHotkey, 
    extractCallerInfo, 
    getBlockTypeDescription, 
    getCommandDescription, 
    getTaskStatusDescription 
} from "./formatters";

/**
 * 全局日志级别配置
 * 默认为 VERBOSE 模式
 * @TODO 不要试图使用模块级别变量作为共享变量,查看项目中目前的注册表机制
 */
let currentLogLevel: LogLevel = LogLevel.VERBOSE;

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
export const setLogLevel = (level: LogLevel) => {
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
export const getLogLevel = () => {
    return currentLogLevel;
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
export const logCommandExecution = (params: CommandLogParams) => {
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
) => {
    const oldStatusDesc = getTaskStatusDescription(oldStatus);
    const newStatusDesc = getTaskStatusDescription(newStatus);
    const result = `状态已从 ${oldStatusDesc} 切换为 ${newStatusDesc}`;
    
    logCommandExecution({
        ...params,
        result
    });
};