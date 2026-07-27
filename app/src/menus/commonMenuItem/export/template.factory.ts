/** 用途：读取模板协议常量；使用范围：Dialog 身份；解耦评估：本域网关直达稳定声明。 */
import {Constants} from "./imports";
/** 用途：构造模板 Dialog；使用范围：factory 边界；解耦评估：具体构造仅保留在本 factory。 */
import {Dialog} from "./imports";
/** 用途：确认覆盖；使用范围：重名分支；解耦评估：本域网关保持人工确认协议。 */
import {confirmDialog} from "./imports";
/** 用途：保存模板；使用范围：确认动作；解耦评估：本域网关保持回调协议。 */
import {fetchPost} from "./imports";
/** 用途：读取默认名；使用范围：菜单点击；解耦评估：本域网关保持异步错误传播。 */
import {fetchSyncPost} from "./imports";
/** 用途：读取文案；使用范围：Dialog 与提示；解耦评估：本域网关保持严格读取。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：选择 Dialog 宽度；使用范围：模板 Dialog；解耦评估：平台事实不由调用方注入。 */
import {isMobile} from "./imports";
/** 用途：规范模板名；使用范围：默认名和提交；解耦评估：本域网关直达纯函数。 */
import {replaceFileName} from "./imports";
/** 用途：提示保存成功；使用范围：保存响应；解耦评估：本域网关使用统一消息 UI。 */
import {showMessage} from "./imports";

/** 保存覆盖模板，并只在内核确认成功时提示。 */
// @柯里化: 人工覆盖确认需要在稍后回调中保留当前文档 ID 与已处理名称。
const overwriteTemplate = (id: string, name: string) => {
    fetchPost("/api/template/docSaveAsTemplate", {id, name, overwrite: true}, response => {
        // 覆盖请求只有成功时沿用既有成功提示，错误继续交由网络层呈现。
        if (response.code === 0) {
            showMessage(getSiyuanLanguages().exportTplSucc);
        }
    });
};

/** 处理首次模板保存结果，重名时保持原确认与二次请求顺序。 */
const handleTemplateSave = (response: IWebSocketData, id: string, name: string) => {
    // 非重名响应沿用既有成功提示；code 1 才进入人工覆盖确认。
    if (response.code !== 1) {
        showMessage(getSiyuanLanguages().exportTplSucc);
        return;
    }
    confirmDialog(getSiyuanLanguages().export, getSiyuanLanguages().exportTplTip, () => overwriteTemplate(id, name));
};

/** 要求模板对话框的固定输入控件存在，缺失时显式暴露渲染错误。 */
const requireTemplateInput = (dialog: Dialog) => {
    const input = dialog.element.querySelector("input");
    if (!(input instanceof HTMLInputElement)) {
        throw new Error("模板导出对话框缺少文件名输入框");
    }
    return input;
};

/** 要求模板对话框的固定操作按钮存在。 */
const requireTemplateButtons = (dialog: Dialog) => {
    const buttons = dialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
    const cancel = buttons[0];
    const confirm = buttons[1];
    if (!cancel || !confirm) {
        throw new Error("模板导出对话框缺少操作按钮");
    }
    return {cancel, confirm};
};

/** 提交模板名称、绑定响应处理并立即关闭输入对话框。 */
const submitTemplate = (dialog: Dialog, id: string, input: HTMLInputElement) => {
    const languages = getSiyuanLanguages();
    input.value = input.value.trim() === "" ? languages.untitled : replaceFileName(input.value);
    fetchPost("/api/template/docSaveAsTemplate", {
        id,
        name: input.value,
        overwrite: false,
    }, response => handleTemplateSave(response, id, input.value));
    dialog.destroy();
};

/** 创建并绑定模板文件名对话框，保留当前输入处理与关闭时序。 */
const openTemplateDialog = (id: string, rawName: string) => {
    const languages = getSiyuanLanguages();
    const dialog = new Dialog({
        title: languages.fileName,
        content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${languages.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_EXPORTTEMPLATE);
    const input = requireTemplateInput(dialog);
    const buttons = requireTemplateButtons(dialog);
    dialog.bindInput(input, () => buttons.confirm.click());
    input.value = rawName.length > 32 ? rawName.substring(0, 32) : rawName;
    input.focus();
    input.select();
    buttons.cancel.addEventListener("click", () => dialog.destroy());
    buttons.confirm.addEventListener("click", () => submitTemplate(dialog, id, input));
};

/** 创建保存为模板菜单项。 @同步豁免: UI构建 - 菜单必须同步组装。 @显式返回类型原因: 固定异步 click 与 IMenu 协议边界。 */
export const createTemplateExportMenuItem = (id: string): IMenu => ({
    id: "exportTemplate",
    label: getSiyuanLanguages().template,
    iconClass: "ft__error",
    icon: "iconMarkdown",
    /** 获取引用文本作为默认名后打开输入对话框。 */
    click: async () => {
        const result = await fetchSyncPost("/api/block/getRefText", {id});
        openTemplateDialog(id, replaceFileName(result.data));
    }
});
