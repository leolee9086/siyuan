import {escapeHtml} from "../util/DOM/escape";

/** 处理主 WebSocket 的页面进度遮罩消息。 */
export const progressLoading = (data: IWebSocketData) => {
    // 结束消息应当是幂等的，不能因为页面没有进度 DOM 而先创建一个再删除。
    if (data.code === 2) {
        document.getElementById("progress")?.remove();
        return;
    }

    let progressElement = document.getElementById("progress");
    if (!progressElement) {
        document.body.insertAdjacentHTML("beforeend", `<div id="progress" style="z-index: ${++window.siyuan.zIndex}"></div>`);
        progressElement = document.getElementById("progress");
    }
    if (!progressElement) {
        return;
    }

    // code 0: 有进度；1: 无进度；2: 关闭
    if (data.code === 0) {
        progressElement.innerHTML = `<div class="b3-dialog__scrim" style="opacity: 1"></div>
<div class="b3-dialog__loading">
    <div style="text-align: right">${data.data.current}/${data.data.total}</div>
    <div style="margin: 8px 0;height: 8px;border-radius: var(--b3-border-radius);overflow: hidden;background-color:#fff;"><div style="width: ${data.data.current / data.data.total * 100}%;transition: var(--b3-transition);background-color: var(--b3-theme-primary);height: 8px;"></div></div>
    <div class="ft__breakword">${escapeHtml(data.msg)}</div>
</div>`;
    } else if (data.code === 1) {
        const messageElement = progressElement.lastElementChild?.lastElementChild;
        if (messageElement) {
            messageElement.innerHTML = escapeHtml(data.msg);
        } else {
            progressElement.innerHTML = `<div class="b3-dialog__scrim" style="opacity: 1"></div>
<div class="b3-dialog__loading">
    <div style="margin: 8px 0;height: 8px;border-radius: var(--b3-border-radius);overflow: hidden;background-color:#fff;"><div style="background-color: var(--b3-theme-primary);height: 8px;background-image: linear-gradient(-45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent);animation: stripMove 450ms linear infinite;background-size: 50px 50px;"></div></div>
    <div class="ft__breakword">${escapeHtml(data.msg)}</div>
</div>`;
        }
    }
};
