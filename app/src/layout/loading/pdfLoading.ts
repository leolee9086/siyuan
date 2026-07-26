/** 用途：显示加载中提示。使用范围：PDF 页签切换门禁。解耦评估：消息展示是阻断操作后的必要反馈，注入不会减少职责耦合。 */
import {showMessage} from "./imports";
/** 用途：读取本地化提示。使用范围：PDF 页签切换门禁。解耦评估：同域无状态环境读取与门禁生命周期一致。 */
import {getPdfLoadingMessage} from "./environment";

/** @同步豁免: UI构建 - 调用方必须在当前页签切换栈内立即决定是否继续。 */
export const pdfIsLoading = (element: HTMLElement) => {
    const isLoading = element.querySelector('.layout-tab-container > [data-loading="true"]') !== null;
    if (isLoading) {
        showMessage(getPdfLoadingMessage());
    }
    return isLoading;
};
