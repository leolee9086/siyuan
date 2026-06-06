/**
 * 用途：定义AI助手响应流的状态结构类型
 * 使用范围：本文件所有函数的参数类型，包含响应内容字符串、DOM内容、工具调用回调等核心状态字段
 * 解耦评估：该类型是流式响应处理的核心数据结构，贯穿整个处理流程；无法通过依赖注入解耦，因为函数签名本身就是对外接口契约；若改为参数传递会导致函数签名膨胀且破坏类型安全
 */
import type { AssistantResponseState } from "./session/session.types";
/**
 * 用途：从渲染后的DOM中提取符合条件的特定语言代码块内容
 * 使用范围：处理工具调用函数中，用于检测并提取工具调用代码块（javascript-tools/javascript-tools-wait）
 * 解耦评估：该函数是DOM解析的核心工具函数，封装了复杂的DOM遍历和条件判断逻辑；可通过依赖注入解耦，但会增加调用复杂度且无实际收益，因为该函数是稳定的工具函数而非易变的业务逻辑
 */
import { 从块DOM提取首个符合条件的特定语言代码块内容 } from "./parser/toolCallDetector";
/**
 * 用途：定义同步工具调用的代码块CSS类名标识
 * 使用范围：processBlockDOMContent函数中，用于从渲染后的DOM中识别需要等待执行的工具调用代码块
 * 解耦评估：该常量是AI工具调用协议的固定约定（代码块language标识），属于协议层硬编码，无法通过依赖注入解耦；若改为参数传递会破坏协议的明确性和稳定性
 */
import { JAVASCRIPT_TOOLS_WAIT_CLASS } from "./constants";
/**
 * 用途：定义异步工具调用的代码块CSS类名标识
 * 使用范围：processBlockDOMContent函数中，用于从渲染后的DOM中识别可异步执行的工具调用代码块
 * 解耦评估：该常量是AI工具调用协议的固定约定（代码块language标识），属于协议层硬编码，无法通过依赖注入解耦；若改为参数传递会破坏协议的明确性和稳定性
 */
import { JAVASCRIPT_TOOLS_CLASS } from "./constants";
/**@AIDONE ES模块系统保证单例特性，模块级cache不会因多次导入产生问题
* 每个模块在运行时只会被实例化一次，所有导入该模块的地方共享同一个cache实例
* 如需清理缓存，外部可通过导出的cache直接操作
*/

/**
 * 用途：工具调用检测缓存，记录已处理的代码块内容
 * 使用范围：checkBlockCondition函数中，用于避免同一代码块被重复触发执行
 * 解耦评估：导出供外部模块在会话生命周期管理时清理缓存（如会话切换时调用cache.clear()）
 */
export const cache = new Map<string, boolean>();

/**
 * 检查代码块是否满足工具调用触发条件
 *
 * 作用：判断当前代码块内容是否为新出现的、位于未闭合代码围栏末尾的工具调用
 * 意图：避免同一代码块被重复触发执行，通过缓存记录已处理的内容
 * 调用时机：由 `从块DOM提取首个符合条件的特定语言代码块内容` 的条件回调调用
 * @同步豁免: 性能考虑 - 作为DOM遍历中的条件判断回调，必须同步返回布尔值
 */
/** @显式返回类型原因: 作为 DOM 遍历条件回调必须严格返回 boolean，显式类型可防止意外返回 undefined/null 导致条件判断失效。 */
const checkBlockCondition = (content: string, state: AssistantResponseState): boolean => {
    let flag = false;
    const lastUsed = cache.get(content);
    // 当响应内容中最后一个代码围栏(```)之后没有实质内容时，说明代码块尚未闭合，此时触发工具调用
    if (!state.responseContentStr.split("\`\`\`").pop()?.trim()) {
        flag = true;
        cache.set(content, flag);
    }
    return !!(flag && !lastUsed);
};

/**
 * 从DOM中检测并执行特定语言的工具调用
 *
 * 作用：在渲染后的blockDOM中查找指定语言类型的代码块，满足条件时触发回调执行
 * 意图：将工具调用检测逻辑与具体的工具类型解耦，通过参数化支持同步/异步两种工具调用
 * 调用时机：processBlockDOMContent 中对每种工具类型各调用一次
 */
const 处理工具调用 = async (
    tempDiv: HTMLElement,
    toolClass: string,
    回调函数: ((code: string) => Promise<void>) | undefined,
    错误信息前缀: string,
    state: AssistantResponseState
)=> {
    const toolCode = await 从块DOM提取首个符合条件的特定语言代码块内容(tempDiv, toolClass, (_blockElement, content) => checkBlockCondition(content, state));
    // 仅在检测到工具代码且回调函数已注册时触发执行
    if (toolCode && 回调函数) {
        回调函数(toolCode).catch(error => {
            console.error(`${错误信息前缀}执行失败:`, error);
        });
    }
};

/**
 * 渲染blockDOM内容并检测工具调用
 *
 * 作用：将响应的Markdown内容通过lute引擎转换为块级DOM，设置助手标记属性，并检测其中的工具调用代码块
 * 意图：SSE流式响应每次追加内容后需要重新渲染DOM并检查是否有新的工具调用出现
 * 调用时机：handleStreamMessage 中每收到有效内容且lute可用时调用
 * 问题：工具调用检测是异步的但本函数被同步调用链使用，工具检测结果以fire-and-forget方式处理
 * @同步豁免: 性能考虑 - SSE流式回调的同步处理链，DOM渲染必须同步完成以保证UI即时更新；工具调用检测以fire-and-forget方式异步执行
 */
export const processBlockDOMContent = (
    state: AssistantResponseState,
    lute: Lute
) => {
    if (!lute) {
        throw new Error("缺少lute实例,无法处理工具调用");
    }
    // 使用lute引擎将内容转换为块级DOM
    const blockDom = lute.SpinBlockDOM(state.responseContentStr);
    state.blockDOMContent = blockDom;
    // 从生成的blockDOM中处理data-node-id属性并设置custom-assistant-name
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = blockDom;
    // 查找所有带有data-node-id属性的元素
    const elementsWithNodeId = tempDiv.querySelectorAll("[data-node-id]");
    for (const element of elementsWithNodeId) {
        // 设置custom-assistant-name属性为default
        element.setAttribute("custom-assistant-name", "default");
    }

    // 检测并处理DOM中的工具调用
    处理工具调用(tempDiv, JAVASCRIPT_TOOLS_WAIT_CLASS, state.onWaitToolCallDetected, "工具调用", state);

    // 检测并处理DOM中的异步工具调用
    处理工具调用(tempDiv, JAVASCRIPT_TOOLS_CLASS, state.onAsyncToolCallDetected, "异步工具调用", state);

    // 更新处理后的blockDOM
    const processedBlockDom = tempDiv.innerHTML;
    state.blockDOMContent = processedBlockDom;
    return processedBlockDom;
};

