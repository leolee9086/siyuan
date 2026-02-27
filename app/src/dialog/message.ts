import { genUUID } from "../util/platform/genID";
import { Constants } from "../constants";

const 尝试隐藏消息 = (target: HTMLElement) => {
    const selection = getSelection();
    const 无选中文本 = !selection || selection.rangeCount === 0 || !selection.getRangeAt(0).toString();
    if (无选中文本) {
        hideMessage(target.getAttribute("data-id") ?? "");
    }
};

const 处理消息点击 = (event: MouseEvent, messageElement: HTMLElement) => {
    let target = event.target as HTMLElement;
    while (target && !target.isEqualNode(messageElement)) {
        if (target.classList.contains("b3-snackbar__close")) {
            hideMessage(target.parentElement?.getAttribute("data-id") ?? "");
            event.preventDefault();
            break;
        }
        if (target.tagName === "A" || target.tagName === "BUTTON") {
            break;
        }
        if (target.classList.contains("b3-snackbar")) {
            尝试隐藏消息(target);
            event.preventDefault();
            event.stopPropagation();
            break;
        }
        target = target.parentElement as HTMLElement;
    }
};

export const initMessage = () => {
    const messageElement = document.getElementById("message");
    messageElement.innerHTML = '<div class="fn__flex-1"></div>';
    messageElement.addEventListener("click", (event) => 处理消息点击(event, messageElement));

    document.querySelectorAll("#tempMessage > div").forEach((item) => {
        showMessage(item.innerHTML, parseInt(item.getAttribute("data-timeout")), item.getAttribute("data-type"), item.getAttribute("data-message-id"));
        item.remove();
    });
};

// type: info/error; timeout: 0 手动关闭；-1 永不关闭

const 创建临时消息 = (message: string, timeout: number, type: string, messageId?: string) => {
    let tempMessages = document.getElementById("tempMessage");
    if (!tempMessages) {
        document.body.insertAdjacentHTML("beforeend", "<div style='font-size: 14px;top: 22px;position: fixed;z-index: 100;right: 30px;line-height: 20px;word-break: break-word;display: flex;flex-direction: column;align-items: flex-end;' id='tempMessage'></div>");
        tempMessages = document.getElementById("tempMessage");
    }
    tempMessages.insertAdjacentHTML("beforeend", `<div style="background: white;padding: 8px 16px;border-radius: 6px;margin-bottom: 16px;" data-timeout="${timeout}" data-type="${type}" data-message-id="${messageId || ""}">${message}</div>`);
};

const 设置消息超时 = (id: string, timeout: number, element?: Element) => {
    if (timeout <= 0) {
return;
}
    const timeoutId = window.setTimeout(() => hideMessage(id), timeout);
    element?.setAttribute("data-timeoutid", timeoutId.toString());
    return timeoutId;
};

const 更新已存在消息 = (existElement: Element, messageVersion: string, timeout: number, type: string, id: string) => {
    window.clearTimeout(parseInt(existElement.getAttribute("data-timeoutid")));
    const closeButton = timeout === 0 ? "<svg class='b3-snackbar__close'><use xlink:href='#iconCloseRound'></use></svg>" : "";
    const contentClass = `b3-snackbar__content${timeout === 0 ? " b3-snackbar__content--close" : ""}`;
    existElement.innerHTML = `<div data-type="textMenu" class="${contentClass}">${messageVersion}</div>${closeButton}`;
    if (type === "error") {
        existElement.classList.add("b3-snackbar--error");
        return 设置消息超时(id, timeout, existElement);
    }
    existElement.classList.remove("b3-snackbar--error");
    设置消息超时(id, timeout, existElement);
};

const 创建新消息HTML = (id: string, messageVersion: string, timeout: number, type: string) => {
    const errorClass = type === "error" ? " b3-snackbar--error" : "";
    const contentClass = `b3-snackbar__content${timeout === 0 ? " b3-snackbar__content--close" : ""}`;
    let html = `<div data-id="${id}" class="b3-snackbar--hide b3-snackbar${errorClass}"><div data-type="textMenu" class="${contentClass}">${messageVersion}</div>`;
    if (timeout === 0) {
        html += '<svg class="b3-snackbar__close"><use xlink:href="#iconCloseRound"></use></svg>';
    }
    if (timeout > 0) {
        const timeoutId = window.setTimeout(() => hideMessage(id), timeout);
        html = html.replace("<div data-id", `<div data-timeoutid="${timeoutId}" data-id`);
    }
    return html + "</div>";
};

const 移除隐藏类 = (messagesElement: Element) => {
    setTimeout(() => {
        const 隐藏的消息 = messagesElement.querySelectorAll(".b3-snackbar--hide");
        隐藏的消息.forEach(item => item.classList.remove("b3-snackbar--hide"));
    });
};

const 移除重复消息 = (messagesElement: Element) => {
    const first = messagesElement.firstElementChild;
    const second = first?.nextElementSibling;
    if (second && second.innerHTML === first.innerHTML) {
        second.remove();
    }
};

export const showMessage = (message: string, timeout = 6000, type = "info", messageId?: string) => {
    if (!message) {
        return;
    }

    const messagesElement = document.getElementById("message").firstElementChild;
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
    messagesElement.parentElement.classList.add("b3-snackbars--show");
    messagesElement.parentElement.style.zIndex = (++window.siyuan.zIndex).toString();
    messagesElement.insertAdjacentHTML("afterbegin", 创建新消息HTML(id, messageVersion, timeout, type));
    移除隐藏类(messagesElement);
    移除重复消息(messagesElement);
    messagesElement.scrollTo({ top: 0, behavior: "smooth" });
    return id;
};

export const hideMessage = (id?: string) => {
    const messagesElement = document.getElementById("message").firstElementChild;
    if (!messagesElement) {
        return;
    }
    // 卫语句：无指定 id 时清除所有消息
    if (!id) {
        messagesElement.parentElement.classList.remove("b3-snackbars--show");
        setTimeout(() => {
            messagesElement.innerHTML = "";
        }, Constants.TIMEOUT_INPUT);
        return;
    }

    // 处理指定 id 的消息
    const messageElement = messagesElement.querySelector(`[data-id="${id}"]`);
    if (messageElement) {
        messageElement.classList.add("b3-snackbar--hide");
        window.clearTimeout(parseInt(messageElement.getAttribute("data-timeoutid")));
        setTimeout(() => {
            messageElement.remove();
            if (messagesElement.childElementCount === 0) {
                messagesElement.parentElement.classList.remove("b3-snackbars--show");
                messagesElement.innerHTML = "";
            }
        }, Constants.TIMEOUT_INPUT);
    }
    const hasShowItem = Array.from(messagesElement.children).some(
        item => !item.classList.contains("b3-snackbar--hide")
    );
    if (hasShowItem) {
        messagesElement.parentElement.classList.add("b3-snackbars--show");
        return;
    }
    messagesElement.parentElement.classList.remove("b3-snackbars--show");
};
