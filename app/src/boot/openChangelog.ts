/** 用途：网络请求工具（POST）。使用范围：获取更新日志数据。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：Dialog 对话框组件。使用范围：展示更新日志内容。解耦评估：通过 ./imports 转发。 */
import { Dialog } from "./imports";
/** 用途：代码高亮渲染器。使用范围：对更新日志 HTML 内容进行代码高亮。解耦评估：通过 ./imports 转发。 */
import { highlightRender } from "./imports";
/** 用途：移动端判断工具。使用范围：根据平台适配对话框尺寸。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：系统常量。使用范围：使用 DIALOG_CHANGELOG 标识对话框。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：国际化文案。使用范围：更新日志标题中展示"新特性"文案。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：安全获取 SiYuan 全局配置。使用范围：读取内核版本号。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";

/**
 * 处理更新日志响应，渲染对话框
 *
 * 作用：解析 fetchPost 返回的更新日志数据，构建并展示对话框
 * 意图：提取公共回调逻辑，避免内联回调导致的可读性下降
 */
function 处理更新日志响应(response: { data: { show: boolean; html: string } }) {
    if (!response.data.show) {
        return;
    }
    const dialog = new Dialog({
        title: `✨ ${siyuanI18n.whatsNewInSiYuan} v${getSiyuanConfig().system.kernelVersion}`,
        width: isMobile() ? "92vw" : "768px",
        height: isMobile() ? "80vh" : "70vh",
        content: `<div style="overflow:auto;" class="b3-dialog__content b3-typography b3-typography--default">${response.data.html}</div>`,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_CHANGELOG);
    highlightRender(dialog.element);
}

/**
 * 打开更新日志对话框
 *
 * 作用：向服务端请求更新日志数据并展示
 * 意图：移动端和桌面端在初始化完成后均可调用此函数显示更新日志
 * 调用时机：应用启动时检测到版本更新后，或用户在设置中手动查看更新日志
 */
export async function openChangelog() {
    fetchPost("/api/system/getChangelog", {}, 处理更新日志响应);
}
