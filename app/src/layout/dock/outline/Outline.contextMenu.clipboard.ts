import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { fetchPost } from "../../../util/network/fetch";
import { transaction } from "../../../protyle/wysiwyg/transaction";
import { genEmptyElement } from "../../../block/element.factory";
import { focusBlock } from "../../../protyle/util/selection";
import { isInAndroid, isInHarmony, writeText } from "../../../protyle/util/compatibility";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowJSAndroid, getWindowJSHarmony } from "../../../util/siyuanEnvironments/windowNative.environment";
import { isHTMLElement } from "../dock.guard";
import type { Outline } from "./Outline";
import { getProtyleAndBlockElement } from "./Outline.contextMenu.edit";

/**
 * 将数据写入剪贴板
 * 作用：根据当前运行环境（Android, HarmonyOS, 或其他），将处理后的 HTML/Markdown 数据写入系统剪贴板。
 * 意图：实现跨平台的剪贴板写入功能，特别适配移动端原生交互。
 * 调用时机：执行复制或剪切操作时调用。
 */
const writeClipboard = (protyle: IProtyle, respData: string) => {
    /**
     * Android 环境检查
     * 作用：检测当前是否在 Android 容器中运行
     * 意图：Android 端需要通过原生桥接方法 writeHTMLClipboard 来写入剪贴板，以支持富文本。
     * 生效场景：App 运行在 Android 设备上时。
     */
    if (isInAndroid()) {
        getWindowJSAndroid()?.writeHTMLClipboard(protyle.lute?.BlockDOM2StdMd(respData).trimEnd() || "", respData + Constants.ZWSP);
        return;
    }

    /**
     * HarmonyOS 环境检查
     * 作用：检测当前是否在鸿蒙系统容器中运行
     * 意图：鸿蒙端同样需要通过原生桥接方法 writeHTMLClipboard 来写入剪贴板。
     * 生效场景：App 运行在鸿蒙设备上时。
     */
    if (isInHarmony()) {
        getWindowJSHarmony()?.writeHTMLClipboard(protyle.lute?.BlockDOM2StdMd(respData).trimEnd() || "", respData + Constants.ZWSP);
        return;
    }

    writeText(respData + Constants.ZWSP);
};

/**
 * 处理空内容的情况
 * 作用：当编辑器内容为空时，插入一个默认的空块
 * 意图：防止编辑器完全清空导致无法输入或显示异常，保持编辑器至少有一个可编辑块。
 * 调用时机：在执行删除操作后，如果删除了所有内容时调用。
 */
const handleEmptyContent = (protyle: IProtyle, doOps: IOperation[], undoOps: IOperation[]) => {
    if (!protyle.wysiwyg) {
        return;
    }

    /**
     * 检查编辑器内容是否为空
     * 作用：判断当前编辑器内是否没有任何子元素
     * 意图：如果编辑器被清空（例如删除了所有标题），需要自动补一个空块以维持编辑器可用状态。
     * 生效场景：执行删除操作导致编辑器变为空时。
     */
    if (protyle.wysiwyg.element.childElementCount === 0) {
        const newID = Lute.NewNodeID(), emptyEl = genEmptyElement(false, false, newID);
        protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyEl);
        doOps.push({ action: "insert", data: emptyEl.outerHTML, id: newID, parentID: protyle.block.parentID });
        undoOps.push({ action: "delete", id: newID });
        focusBlock(emptyEl);
    }
};

/**
 * 删除指定操作对应的 DOM 元素
 * 作用：根据操作中的节点 ID，从 protyle 中删除对应的 DOM 元素
 * 意图：在执行剪切/删除操作时，需要同步更新 DOM 视图
 */
const 删除操作对应元素 = (protyle: IProtyle, operations: IOperation[]) => {
    if (!protyle.wysiwyg) {
        return;
    }
    for (const op of operations) {
        const elements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`);
        for (const el of elements) {
            // 类型守卫：querySelectorAll 返回 Element 类型，需要确认是 HTMLElement 才能调用 remove()
            if (isHTMLElement(el)) {
                el.remove();
            }
        }
    }
};



/**
 * 创建删除标题响应处理器
 * 作用：处理删除标题的事务响应，删除 DOM 元素并记录事务
 * 调用时机：点击"删除"菜单项后，API 返回删除事务时调用
 */
const 创建删除标题响应处理器 = (protyle: IProtyle) => (resp: IWebSocketData) => {
    删除操作对应元素(protyle, resp.data.doOperations);
    handleEmptyContent(protyle, resp.data.doOperations, resp.data.undoOperations);
    transaction(protyle, resp.data.doOperations, resp.data.undoOperations);
};

/**
 * 创建剪切标题内层响应处理器
 * 作用：在写入剪贴板后，执行删除标题的操作
 * 调用时机：剪切操作获取到标题内容后调用
 */
const 创建剪切标题内层处理器 = (protyle: IProtyle, id: string) => (resp: IWebSocketData) => {
    writeClipboard(protyle, resp.data);
    fetchPost("/api/block/getHeadingDeleteTransaction", { id }, 创建删除标题响应处理器(protyle));
};

/**
 * 复制标题及其子内容
 * 作用：将标题及其所有子块的内容复制到剪贴板
 * 调用时机：用户点击"复制"菜单项时触发
 */
const 处理复制标题点击 = (outline: Outline, element: HTMLElement, id: string) => {
    const data = getProtyleAndBlockElement(outline, element);
    if (!data) {
        return;
    }
    const foldAttr = data.blockElement.getAttribute("fold");
    fetchPost("/api/block/getHeadingChildrenDOM", { id, removeFoldAttr: foldAttr !== "1" }, (resp) => {
        writeClipboard(data.protyle, resp.data);
    });
};

/**
 * 剪切标题及其子内容
 * 作用：将标题及其所有子块的内容复制到剪贴板，然后删除这些块
 * 调用时机：用户点击"剪切"菜单项时触发
 */
const 处理剪切标题点击 = (outline: Outline, element: HTMLElement, id: string) => {
    const data = getProtyleAndBlockElement(outline, element);
    if (!data) {
        return;
    }
    const foldAttr = data.blockElement.getAttribute("fold");
    fetchPost("/api/block/getHeadingChildrenDOM", { id, removeFoldAttr: foldAttr !== "1" }, 创建剪切标题内层处理器(data.protyle, id));
};

/**
 * 删除标题及其子内容
 * 作用：删除标题及其所有子块
 * 调用时机：用户点击"删除"菜单项时触发
 */
const 处理删除标题点击 = (outline: Outline, element: HTMLElement, id: string) => {
    const data = getProtyleAndBlockElement(outline, element);
    if (!data) {
        return;
    }
    fetchPost("/api/block/getHeadingDeleteTransaction", { id }, 创建删除标题响应处理器(data.protyle));
};

/** 添加复制/剪切/删除菜单项 */
/** @同步豁免: UI构建 */
export function appendClipboardMenuItems(outline: Outline, element: HTMLElement, id: string) {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copyHeadings1", icon: "iconCopy", label: `${siyuanI18n.copy} ${siyuanI18n.headings1}`,
        /**
         * 响应点击事件
         * 作用：触发复制标题操作
         * 意图：作为菜单项的回调函数
         * 调用时机：点击时
         */
        click: () => 处理复制标题点击(outline, element, id)
    }).element);
    /**
     * 只读模式检查：只有在非只读模式下才显示"剪切"和"删除"菜单项。
     * 意图：剪切和删除操作会修改文档内容，在只读模式下应禁止这些操作，只保留"复制"功能可用。
     * 生效场景：当 getSiyuanConfig().readonly 为 true 时（如只读文档、演示模式等），这个分支不执行。
     */
    if (!getSiyuanConfig().readonly) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "cutHeadings1", icon: "iconCut", label: `${siyuanI18n.cut} ${siyuanI18n.headings1}`,
            /**
             * 响应点击事件
             * 作用：触发剪切标题操作
             * 意图：作为菜单项的回调函数
             * 调用时机：点击时
             */
            click: () => 处理剪切标题点击(outline, element, id)
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "deleteHeadings1", icon: "iconTrashcan", label: `${siyuanI18n.delete} ${siyuanI18n.headings1}`,
            /**
             * 响应点击事件
             * 作用：触发删除标题操作
             * 意图：作为菜单项的回调函数
             * 调用时机：点击时
             */
            click: () => 处理删除标题点击(outline, element, id)
        }).element);
    }
}
