import { Constants } from "../constants";
import { genUUID } from "../util/platform/genID";
import { getWindow } from "../util/siyuanEnvironments/getWindow.environment";
import { clearTimeout, setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";

/** 尝试隐藏消息 */
function 尝试隐藏消息(target: HTMLElement) {
    const selection = getSelection();
    const hasSelection = selection && selection.rangeCount > 0 && selection.getRangeAt(0).toString();
    // 无选中文本时隐藏消息
    if (!hasSelection) {
        hideMessage(target.getAttribute("data-id") ?? "");
    }
}

/** 处理消息点击 */
function 处理消息点击(event: MouseEvent, messageElement: HTMLElement) {
    let target: Element | null = event.target instanceof Element ? event.target : null;
    while (target && !target.isEqualNode(messageElement)) {
        // 关闭按钮点击时隐藏消息
        if (target.classList.contains("b3-snackbar__close")) {
            hideMessage(target.parentElement?.getAttribute("data-id") ?? "");
            event.preventDefault();
            break;
        }
        // A/BUTTON 标签不处理
        if (target.tagName === "A" || target.tagName === "BUTTON") {
            break;
        }
        // 消息体点击时尝试隐藏
        if (target.classList.contains("b3-snackbar")) {
            尝试隐藏消息(target);
            event.preventDefault();
            event.stopPropagation();
            break;
        }
        target = target.parentElement;
    }
}

/** 初始化消息系统 */
export async function initMessage() {
    const messageElement = document.getElementById("message");
    if (messageElement) {
        messageElement.innerHTML = '<div class="fn__flex-1"></div>';
        messageElement.addEventListener("click", (event) => 处理消息点击(event, messageElement));
    }

    const tempMessages = document.querySelectorAll("#tempMessage > div");
    for (const item of tempMessages) {
        showMessage(
            item.innerHTML,
            parseInt(item.getAttribute("data-timeout") ?? "6000"),
            item.getAttribute("data-type") ?? "info",
            item.getAttribute("data-message-id")
        );
        item.remove();
    }
}

/** 创建临时消息 */
function 创建临时消息(message: string, timeout: number, type: string, messageId?: string) {
    let tempMessages = document.getElementById("tempMessage");
    if (!tempMessages) {
        document.body.insertAdjacentHTML("beforeend", "<div style='font-size:14px;top:22px;position:fixed;z-index:100;right:30px;line-height:20px;word-break:break-word;display:flex;flex-direction:column;align-items:flex-end' id='tempMessage'></div>");
        tempMessages = document.getElementById("tempMessage");
    }
    if (tempMessages) {
        tempMessages.insertAdjacentHTML("beforeend",
            `<div style="background:white;padding:8px 16px;border-radius:6px;margin-bottom:16px" data-timeout="${timeout}" data-type="${type}" data-message-id="${messageId || ""}">${message}</div>`);
    }
}

/** 设置消息超时 */
function 设置消息超时(id: string, timeout: number, element?: Element) {
    if (timeout <= 0) {
        return;
    }
    // 设置定时自动关闭
    const timeoutId = setTimeout(() => hideMessage(id), timeout);
    element?.setAttribute("data-timeoutid", String(timeoutId));
}

/** 更新已存在消息 */
function 更新已存在消息(existElement: Element, messageVersion: string, timeout: number, type: string, id: string) {
    clearTimeout(parseInt(existElement.getAttribute("data-timeoutid") ?? "0"));
    const closeButton = timeout === 0 ? "<svg class='b3-snackbar__close'><use xlink:href='#iconCloseRound'></use></svg>" : "";
    const contentClass = `b3-snackbar__content${timeout === 0 ? " b3-snackbar__content--close" : ""}`;
    existElement.innerHTML = `<div data-type="textMenu" class="${contentClass}">${messageVersion}</div>${closeButton}`;
    // 错误类型消息添加错误样式
    if (type === "error") {
        existElement.classList.add("b3-snackbar--error");
        设置消息超时(id, timeout, existElement);
        return;
    }
    existElement.classList.remove("b3-snackbar--error");
    设置消息超时(id, timeout, existElement);
}

/** 创建新消息 HTML */
function 创建新消息HTML(id: string, messageVersion: string, timeout: number, type: string) {
    const errorClass = type === "error" ? " b3-snackbar--error" : "";
    const contentClass = `b3-snackbar__content${timeout === 0 ? " b3-snackbar__content--close" : ""}`;
    let html = `<div data-id="${id}" class="b3-snackbar--hide b3-snackbar${errorClass}"><div data-type="textMenu" class="${contentClass}">${messageVersion}</div>`;
    // 手动关闭模式添加关闭按钮
    if (timeout === 0) {
        html += '<svg class="b3-snackbar__close"><use xlink:href="#iconCloseRound"></use></svg>';
    }
    // 自动关闭模式设置超时
    if (timeout > 0) {
        // 消息显示指定时长后自动关闭
        const timeoutId = setTimeout(() => hideMessage(id), timeout);
        html = html.replace("<div data-id", `<div data-timeoutid="${timeoutId}" data-id`);
    }
    return html + "</div>";
}



/** 移除重复消息 */
function 移除重复消息(messagesElement: Element) {
    const first = messagesElement.firstElementChild;
    const second = first?.nextElementSibling;
    // 内容相同的相邻消息移除较晚添加的
    if (second && first && second.innerHTML === first.innerHTML) {
        second.remove();
    }
}

/** 延迟移除以触发隐藏动画 */
function scheduleMessageRemoval(messageElement: Element, container: Element, parent: HTMLElement | null) {
    messageElement.classList.add("b3-snackbar--hide");
    clearTimeout(parseInt(messageElement.getAttribute("data-timeoutid") ?? "0"));
    // 延迟移除以触发隐藏动画
    setTimeout(() => doClearMessage(messageElement, container, parent), Constants.TIMEOUT_INPUT);
}

/** 执行消息清除 */
function doClearMessage(messageElement: Element, container: Element, parent: HTMLElement | null) {
    messageElement.remove();
    // 容器无子元素时重置状态
    if (container.childElementCount === 0) {
        parent?.classList.remove("b3-snackbars--show");
        container.innerHTML = "";
    }
}

/** 显示消息 */
export async function showMessage(message: string, timeout = 6000, type = "info", messageId?: string) {
    if (!message) {
        return;
    }

    const messagesParent = document.getElementById("message");
    const messagesElement = messagesParent?.firstElementChild;
    if (!messagesElement) {
        创建临时消息(message, timeout, type, messageId);
        return;
    }
    const id = messageId || genUUID();
    const existElement = messagesElement.querySelector(`.b3-snackbar[data-id="${id}"]`);
    const messageVersion = message + (type === "error" ? " v" + Constants.SIYUAN_VERSION : "");
    if (existElement) {
        更新已存在消息(existElement, messageVersion, timeout, type, id);
        return;
    }
    messagesParent?.classList.add("b3-snackbars--show");
    if (messagesParent) {
        messagesParent.style.zIndex = (++getWindow().siyuan.zIndex).toString();
    }
    messagesElement.insertAdjacentHTML("afterbegin", 创建新消息HTML(id, messageVersion, timeout, type));
    // 延迟移除隐藏类以触发动画
    setTimeout(() => {
        const items = messagesElement.querySelectorAll(".b3-snackbar--hide");
        for (const item of items) {
            item.classList.remove("b3-snackbar--hide");
        }
    });
    移除重复消息(messagesElement);
    messagesElement.scrollTo({ top: 0, behavior: "smooth" });
    return id;
}

/** 隐藏消息 */
export async function hideMessage(id?: string) {
    const messagesParent = document.getElementById("message");
    const messagesElement = messagesParent?.firstElementChild;
    if (!(messagesElement instanceof HTMLElement)) {
        return;
    }
    if (!id) {
        messagesParent?.classList.remove("b3-snackbars--show");
        // 延迟清空以触发动画
        setTimeout(() => {
            messagesElement.innerHTML = "";
        }, Constants.TIMEOUT_INPUT);
        return;
    }

    const messageElement = messagesElement.querySelector(`[data-id="${id}"]`);
    // 找到对应消息时执行隐藏动画并清理
    if (messageElement) {
        scheduleMessageRemoval(messageElement, messagesElement, messagesParent);
    }
    const hasShowItem = Array.from(messagesElement.children).some(
        (item) => !item.classList.contains("b3-snackbar--hide")
    );
    if (hasShowItem) {
        messagesParent?.classList.add("b3-snackbars--show");
        return;
    }
    messagesParent?.classList.remove("b3-snackbars--show");
}
