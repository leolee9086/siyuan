/** 用途：转义导出路径，避免消息 HTML 注入；使用范围：`afterExport` 成功提示内容；解耦评估：纯工具函数，已通过 `imports` 网关降低路径耦合。 */
import {escapeHtml} from "./imports";
/** 用途：隐藏消息提示；使用范围：导出完成后清理进行中提示；解耦评估：UI 基础设施能力，当前直接调用成本最低。 */
import {hideMessage} from "./imports";
/** 用途：展示消息提示；使用范围：导出成功提示与导出过程提示；解耦评估：UI 基础设施能力，未来可事件化，但当前直接调用更直观。 */
import {showMessage} from "./imports";
/** 用途：导出相关常量；使用范围：导出流程标识传递；解耦评估：全局常量依赖，不应改为硬编码。 */
import {Constants} from "./imports";
/** 用途：在本地文件管理器中定位导出文件；使用范围：Electron 场景点击"在文件夹中显示"；解耦评估：平台能力封装，直接复用最稳定。 */
import {useShell} from "./imports";
/** 用途：国际化文案访问；使用范围：导出提示与弹窗标题文案；解耦评估：文案服务全局共享，直接依赖符合项目架构。 */
import {siyuanI18n} from "./imports";
/** 用途：Electron 环境判断；使用范围：仅桌面端展示"在文件夹中显示"；解耦评估：平台判断基础能力，不应在业务层重写。 */
import {isElectron} from "./imports";
/** 用途：Node 模块加载边界；使用范围：仅 Electron 导出路径；解耦评估：Web 构建由 resolver 替换为浏览器 stub。 */
import {nativeRequire} from "./imports";
/** 用途：导出图片流程上下文创建器；使用范围：`exportImage` 入口创建弹窗与数据上下文；解耦评估：上下文创建独立便于 tab/dialog 宿主复用。 */
import {createExportImageContext} from "./image/exportImage.context";
/** 用途：导出图片共享 panel 初始化入口；使用范围：`exportImage` 入口完成背景/事件绑定与首次预览加载；解耦评估：面板初始化独立模块使 dialog/tab 两种宿主可复用同一套界面逻辑。 */
import {initializeExportImagePanel} from "./image/exportImage.helpers";

/**
 * 作用：导出完成后统一处理成功提示，并在 Electron 中绑定"在文件夹中显示"按钮。
 * 意图：把导出成功反馈逻辑收敛到单点，避免多处重复拼装消息与事件。
 * 调用时机：HTML/PDF/图片等导出流程成功后。
 * 问题/改进：当前依赖消息 DOM 结构，后续可考虑让消息组件直接支持 action 回调。
 */
// 导出语句注释：导出完成后的统一收尾逻辑。
export const afterExport = async (exportPath: string, msgId: string) => {
    if (!isElectron) {
        return;
    }

    const path = nativeRequire<typeof import("path")>("path");
    showMessage(`${siyuanI18n.exported} ${escapeHtml(exportPath)}
<div class="fn__space"></div>
<button class="b3-button b3-button--white">${siyuanI18n.showInFolder}</button>`, 6000, "info", msgId);

    const buttonElement = document.querySelector(`#message [data-id="${msgId}"] button`);
    if (!buttonElement) {
        return;
    }

    buttonElement.addEventListener("click", () => {
        useShell("showItemInFolder", path.join(exportPath));
        hideMessage(msgId);
    });
};

/**
 * 作用：创建导出为图片的弹窗，初始化界面与事件绑定，并加载预览。
 * 意图：保持入口简洁，将弹窗构建、事件绑定与预览加载串联在一起，
 *       同时消除 `runExportImageFlow` 这一无意义的中转层。
 * 调用时机：用户在导出菜单选择"导出为图片"时。
 * 问题/改进：后续可把 fetch 回调链路改造为 Promise 以统一异步风格。
 */
// 导出语句注释：导出图片主流程入口。
export const exportImage = async (id: string) => {
    const ctx = await createExportImageContext(id, Constants.DIALOG_EXPORTIMAGE);
    if (!ctx) {
        return;
    }
    await initializeExportImagePanel(ctx);
};
