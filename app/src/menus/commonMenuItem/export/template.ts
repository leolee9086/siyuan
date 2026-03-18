/**
 * 用途：模板导出菜单项构建函数
 * 使用范围：exportMd 函数中使用
 * 解耦评估：将模板导出逻辑独立为单独模块，提高可维护性
 */

/**
 * 用途：显示确认对话框，用于需要用户二次确认的操作
 * 使用范围：模板导出覆盖确认场景
 * 解耦评估：对话框是通用UI组件，无法通过依赖注入解耦，必须直接导入
 */
import { confirmDialog } from "../imports";
/**
 * 用途：获取应用常量配置，用于设置对话框标识
 * 使用范围：对话框 data-key 属性设置
 * 解耦评估：常量配置是全局共享的，无法解耦，必须直接导入
 */
import { Constants } from "../imports";
/**
 * 用途：创建对话框实例，用于用户输入交互
 * 使用范围：模板导出文件名输入场景
 * 解耦评估：对话框是核心UI组件，无法通过参数传递解耦，必须直接导入
 */
import { Dialog } from "../imports";
/**
 * 用途：发送异步 POST 请求到后端 API
 * 使用范围：模板保存请求
 * 解耦评估：网络请求是基础设施层，无法解耦，必须直接导入
 */
import { fetchPost } from "../imports";
/**
 * 用途：发送同步 POST 请求到后端 API
 * 使用范围：模板导出前获取文档标题
 * 解耦评估：网络请求是基础设施层，无法解耦，必须直接导入
 */
import { fetchSyncPost } from "../imports";
/**
 * 用途：检测是否为移动端环境
 * 使用范围：对话框宽度自适应判断
 * 解耦评估：环境检测是基础设施层，无法解耦，必须直接导入
 */
import { isMobile } from "../imports";
/**
 * 用途：替换文件名中的非法字符
 * 使用范围：模板导出文件名处理
 * 解耦评估：文件名处理是纯函数，可以通过参数传递解耦，但当前架构未实现
 */
import { replaceFileName } from "../imports";
/**
 * 用途：显示消息提示
 * 使用范围：模板保存成功提示
 * 解耦评估：消息提示是全局UI组件，无法通过事件解耦，必须直接导入
 */
import { showMessage } from "../imports";
/**
 * 用途：获取国际化文本
 * 使用范围：对话框标题和按钮文本
 * 解耦评估：国际化是全局配置，无法解耦，必须直接导入
 */
import { siyuanI18n } from "../imports";

/**
 * 作用：处理模板保存响应
 * 意图：根据响应码决定是否需要覆盖确认
 * 调用时机：模板保存请求返回时
 * @param response 后端响应数据
 * @param id 文档 ID
 * @param inputValue 用户输入的模板名称
 */
// @柯里化
/**
 * 作用：处理模板覆盖保存
 * 意图：当存在同名模板时执行覆盖保存，通过柯里化捕获上下文参数
 * 调用时机：用户确认覆盖时
 * @param id 文档 ID
 * @param inputValue 模板名称
 */
const performTemplateOverwrite = (id: string, inputValue: string) => {
    fetchPost("/api/template/docSaveAsTemplate", {
        id,
        name: inputValue,
        overwrite: true
    }, resp => {
        // 检查覆盖保存是否成功
        if (resp.code === 0) {
            showMessage(siyuanI18n.exportTplSucc);
        }
    });
};

/**
 * 作用：处理模板保存响应
 * 意图：根据响应码决定是否需要覆盖确认
 * 调用时机：模板保存请求返回时
 * @param response 后端响应数据
 * @param id 文档 ID
 * @param inputValue 用户输入的模板名称
 */
const handleTemplateOverwrite = (response: IWebSocketData, id: string, inputValue: string) => {
    // 检查是否存在同名模板，不存在则直接成功
    if (response.code !== 1) {
        showMessage(siyuanI18n.exportTplSucc);
        return;
    }
    
    // 存在同名模板，显示覆盖确认对话框
    // @内联回调
    confirmDialog(siyuanI18n.export, siyuanI18n.exportTplTip, () => performTemplateOverwrite(id, inputValue));
};

/**
 * 作用：保存文档为模板
 * 意图：将用户输入的模板名称发送到后端保存
 * 调用时机：用户点击确认按钮时
 * @param id 文档 ID
 * @param inputElement 输入框元素
 * @param dialog 对话框实例
 */
const saveDocAsTemplate = (id: string, inputElement: HTMLInputElement, dialog: Dialog) => {
    const maxNameLen = 32;
    const trimmedValue = inputElement.value.trim();
    
    // 如果输入为空，使用默认名称，否则替换非法字符
    const processedName = trimmedValue === "" ? siyuanI18n.untitled : replaceFileName(trimmedValue);
    
    // 限制文件名长度
    const finalName = processedName.length > maxNameLen
        ? processedName.substring(0, maxNameLen)
        : processedName;
    
    inputElement.value = finalName;
    
    fetchPost("/api/template/docSaveAsTemplate", {
        id,
        name: finalName,
        overwrite: false
    }, (response) => handleTemplateOverwrite(response, id, finalName));
    
    dialog.destroy();
};

/**
 * 作用：创建模板导出对话框
 * 意图：显示文件名输入对话框供用户输入模板名称
 * 调用时机：用户点击模板导出菜单项时
 * @param id 文档 ID
 * @param defaultName 默认模板名称
 */
const createTemplateDialog = async (id: string, defaultName: string) => {
    const dialog = new Dialog({
        title: siyuanI18n.fileName,
        content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    
    dialog.element.setAttribute("data-key", Constants.DIALOG_EXPORTTEMPLATE);
    
    const inputElement = dialog.element.querySelector("input");
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    
    if (!inputElement || !btnsElement[0] || !btnsElement[1]) {
        return;
    }
    
    dialog.bindInput(inputElement, () => {
        const confirmBtn = btnsElement[1];
        // 类型守卫：确保按钮是 HTMLButtonElement 才能调用 click 方法
        if (confirmBtn instanceof HTMLButtonElement) {
            confirmBtn.click();
        }
    });
    
    const maxNameLen = 32;
    let name = defaultName;
    // 限制文件名长度，避免过长的文件名
    if (name.length > maxNameLen) {
        name = name.substring(0, maxNameLen);
    }
    
    inputElement.value = name;
    inputElement.focus();
    inputElement.select();
    
    const cancelBtn = btnsElement[0];
    /**
     * 作用：处理取消按钮点击事件
     * 意图：关闭对话框
     * 调用时机：用户点击取消按钮时
     */
    cancelBtn.addEventListener("click", () => {
        dialog.destroy();
    });
    
    const confirmBtn = btnsElement[1];
    // @柯里化
    /**
     * 作用：处理确认按钮点击事件
     * 意图：保存模板到服务器
     * 调用时机：用户点击确认按钮时
     */
    confirmBtn.addEventListener("click", () => saveDocAsTemplate(id, inputElement, dialog));
};

/**
 * 作用：创建模板导出菜单项
 * 意图：提供将文档保存为模板的功能
 * 调用时机：在 exportMd 函数中构建导出菜单时调用
 * @同步豁免: UI构建 - 返回菜单配置对象供菜单系统同步渲染
 * @param id 文档 ID
 * @returns 模板导出菜单项配置对象
 */
export const createTemplateExportMenuItem = (id: string): IMenu => ({
    id: "exportTemplate",
    label: siyuanI18n.template,
    iconClass: "ft__error",
    icon: "iconMarkdown",
    /**
     * 作用：处理模板导出点击事件
     * 意图：获取文档标题并显示输入对话框
     * 调用时机：用户点击菜单项时
     */
    click: async () => {
        const result = await fetchSyncPost("/api/block/getRefText", { id });
        const defaultName = replaceFileName(result.data);
        await createTemplateDialog(id, defaultName);
    }
});
