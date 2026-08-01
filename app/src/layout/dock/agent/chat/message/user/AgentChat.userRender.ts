/** 用途：关闭用户消息块 DOM 编辑能力；使用范围：富文本后处理。 */
import {disabledWYSIWYG} from "./imports";
/** 用途：执行默认富文本后处理；使用范围：宿主未注入渲染端口时。 */
import {postRender} from "./imports";
/** 用途：约束渲染状态；使用范围：本文件全部函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：取得消息正文元素；使用范围：只读渲染。 */
import {requireElement} from "./imports";

/**
 * 创建用户消息的只读块 DOM 正文。
 * @同步豁免: 消息元素必须在追加到消息列表前同步完成结构构建。
 */
export function createUserMessageBody(runtime: AgentChatRuntime, text: string, blockHTML?: string) {
    const body = document.createElement("div");
    body.className = "agent-chat__body protyle-wysiwyg";
    body.setAttribute("contenteditable", "false");
    body.setAttribute("data-readonly", "true");
    body.innerHTML = blockHTML || runtime.lute.Md2BlockDOM(text);
    return body;
}

/**
 * 完成用户消息的富文本后处理和只读锁定。
 * @同步豁免: DOM 后处理必须紧随元素插入执行，避免可编辑状态短暂暴露。
 */
export function renderUserMessage(runtime: AgentChatRuntime, element: HTMLElement) {
    const body = requireElement<HTMLElement>(element, ".agent-chat__body");
    if (runtime.capabilities.postRender) {
        runtime.capabilities.postRender(element);
    }
    if (!runtime.capabilities.postRender) {
        postRender(element);
    }
    runtime.composer?.renderBlockHTML(body, () => {
        disabledWYSIWYG(body);
    });
    disabledWYSIWYG(body);
}
