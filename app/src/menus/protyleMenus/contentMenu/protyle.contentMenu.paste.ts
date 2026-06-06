/**
 * 用途：聚焦到当前编辑器选区
 * 使用范围：执行粘贴动作前恢复焦点
 * 解耦评估：通过 imports.ts 转发，选区能力与菜单逻辑解耦
 */
import { focusByRange } from "./imports";
/**
 * 用途：获取编辑器 Range
 * 使用范围：执行粘贴动作前定位块选区
 * 解耦评估：通过 imports.ts 转发，选区能力与菜单逻辑解耦
 */
import { getEditorRange } from "./imports";
/**
 * 用途：访问全局菜单单例
 * 使用范围：追加粘贴相关菜单项
 * 解耦评估：通过 imports.ts 转发，菜单依赖边界清晰
 */
import { getSiyuanGlobalMenus } from "./imports";
/**
 * 用途：获取国际化文案
 * 使用范围：粘贴菜单项文案渲染
 * 解耦评估：通过 imports.ts 转发，i18n 依赖统一
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：读取配置
 * 使用范围：粘贴为纯文本菜单显示快捷键
 * 解耦评估：通过 imports.ts 转发，配置访问统一
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：读取剪贴板内容
 * 使用范围：原生粘贴不可用时走降级分支
 * 解耦评估：通过 imports.ts 转发，兼容能力与业务流程解耦
 */
import { readClipboard } from "./imports";
/**
 * 用途：执行富文本粘贴
 * 使用范围：降级分支将剪贴板内容写入编辑器
 * 解耦评估：通过 imports.ts 转发，粘贴能力入口统一
 */
import { paste } from "./imports";
/**
 * 用途：执行纯文本粘贴
 * 使用范围：pasteAsPlainText 菜单项
 * 解耦评估：通过 imports.ts 转发，粘贴能力入口统一
 */
import { pasteAsPlainText } from "./imports";
/**
 * 用途：执行转义粘贴
 * 使用范围：pasteEscaped 菜单项
 * 解耦评估：通过 imports.ts 转发，粘贴能力入口统一
 */
import { pasteEscaped } from "./imports";
/**
 * 用途：构建菜单项实例
 * 使用范围：创建粘贴相关菜单项
 * 解耦评估：通过 imports.ts 转发，组件依赖集中管理
 */
import { MenuItem } from "./imports";
/**
 * 用途：HTMLElement 类型守卫
 * 使用范围：降级粘贴前校验目标元素类型
 * 解耦评估：同目录 guard 模块，类型收窄逻辑独立
 */
import { isHTMLElement } from "./protyle.contentMenu.guard";

/**
 * 添加粘贴相关菜单项。
 * @同步豁免: UI构建 - 菜单项必须在右键菜单构建阶段同步追加。
 */
export const 添加粘贴菜单 = (protyle: IProtyle, nodeElement: Element, captionElement: false | HTMLElement) => {
    // 表格caption内或只读模式下不显示粘贴菜单，防止破坏表格标题结构
    if (protyle.disabled || captionElement) {
        return;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "paste",
        label: siyuanI18n.paste,
        icon: "iconPaste",
        accelerator: "⌘V",
        /** 粘贴剪贴板内容，优先使用浏览器原生 execCommand，降级为手动读取剪贴板 */
        async click() {
            focusByRange(getEditorRange(nodeElement));
            // 部分浏览器/环境支持原生 paste 命令，此时直接调用，避免权限申请
            if (document.queryCommandSupported("paste")) {
                document.execCommand("paste");
                return;
            }
            try {
                const text = await readClipboard();
                if (!isHTMLElement(nodeElement)) {
                    return;
                }
                paste(protyle, Object.assign(text, { target: nodeElement }));
            } catch (e) {
                console.log(e);
            }
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "pasteAsPlainText",
        label: siyuanI18n.pasteAsPlainText,
        accelerator: getSiyuanConfig().keymap.editor.general.pasteAsPlainText.custom,
        /** 以纯文本形式粘贴，去除富文本格式 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            pasteAsPlainText(protyle);
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "pasteEscaped",
        label: siyuanI18n.pasteEscaped,
        /** 粘贴并自动转义 Markdown 特殊字符，避免影响文档结构 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            pasteEscaped(protyle, nodeElement);
        }
    }).element);
};
