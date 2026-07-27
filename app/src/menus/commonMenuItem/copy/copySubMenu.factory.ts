/** 用途：执行基础复制类型；使用范围：复制项点击；解耦评估：经本域网关直达唯一实现。 */
import {copyTextByType} from "./imports";
/** 用途：请求标准 Markdown；使用范围：Markdown 复制项；解耦评估：经本域网关保持当前请求协议。 */
import {fetchSyncPost} from "./imports";
/** 用途：复制后恢复块焦点；使用范围：带焦点元素的菜单项；解耦评估：经本域网关直达唯一实现。 */
import {focusBlock} from "./imports";
/** 用途：读取快捷键；使用范围：菜单组装；解耦评估：经本域网关读取稳定环境。 */
import {getSiyuanConfig} from "./imports";
/** 用途：控制浏览器专属条目；使用范围：菜单组装；解耦评估：经本域网关读取平台事实。 */
import {isElectron} from "./imports";
/** 用途：读取菜单文案；使用范围：全部复制项；解耦评估：经本域网关读取稳定 i18n 环境。 */
import {siyuanI18n} from "./imports";
/** 用途：写入标准 Markdown；使用范围：Markdown 复制项；解耦评估：经本域网关直达唯一实现。 */
import {writeText} from "./imports";

/**
 * 创建语义相同的基础复制项；菜单组装时调用，以统一复制后恢复焦点的既有顺序。
 * @显式返回类型原因: 固定为 IMenu，避免可选 accelerator 在数组组合时扩大为不兼容联合类型。
 */
const createCopyItem = (options: {
    ids: string[];
    type: Parameters<typeof copyTextByType>[1];
    id: string;
    label: string;
    accelerator: string | undefined;
    focusElement: Element | undefined;
}): IMenu => ({
    id: options.id,
    iconHTML: "",
    label: options.label,
    ...(options.accelerator === undefined ? {} : {accelerator: options.accelerator}),
    /** 执行对应复制动作，并在请求发起后按既有顺序恢复传入块的焦点。 */
    click: () => {
        copyTextByType(options.ids, options.type);
        if (options.focusElement) {
            focusBlock(options.focusElement);
        }
    },
});

/** 创建标准 Markdown 复制项；仅在调用方提供文档 ID 时由完整菜单组装函数追加。 */
const createMarkdownCopyItem = (stdMarkdownId: string, focusElement?: Element) => ({
    id: "copyMarkdown",
    iconHTML: "",
    label: siyuanI18n.copyMarkdown,
    /** 获取标准 Markdown 后写入剪贴板，完成后恢复传入块的焦点。 */
    click: async () => {
        const response = await fetchSyncPost("/api/export/exportMdContent", {
            id: stdMarkdownId,
            refMode: 3,
            embedMode: 1,
            yfm: false,
            fillCSSVar: false,
            adjustHeadingLevel: false,
        });
        writeText(response.data.content);
        if (focusElement) {
            focusBlock(focusElement);
        }
    },
});

/**
 * 创建与当前编辑器平台一致的完整复制子菜单，供文件树、页签、搜索和编辑器菜单同步组装。
 * @同步豁免: UI构建 - 菜单必须在当前调用栈中完成组装。
 * @参数豁免: 遗留代码 - 四参数是现有八个调用点的公共协议，本次行为迁移保持调用表面不变。
 * @显式返回类型原因: 复制菜单是跨模块公共能力，固定 IMenu[] 防止平台条件项改变调用方类型。
 */
export const copySubMenu =
    /** @参数豁免: 遗留代码 - 保持现有四参数复制菜单 API 与全部调用点兼容。 */
    (
    ids: string[],
    showAccelerator = true,
    focusElement?: Element,
    stdMarkdownId?: string,
    ): IMenu[] => {
    const keymap = getSiyuanConfig().keymap.editor.general;
    const menuItems: IMenu[] = [];
    menuItems.push(
        createCopyItem({ids, type: "ref", id: "copyBlockRef", label: siyuanI18n.copyBlockRef,
            accelerator: showAccelerator ? keymap.copyBlockRef.custom : undefined, focusElement}),
        createCopyItem({ids, type: "blockEmbed", id: "copyBlockEmbed", label: siyuanI18n.copyBlockEmbed,
            accelerator: showAccelerator ? keymap.copyBlockEmbed.custom : undefined, focusElement}),
        createCopyItem({ids, type: "protocol", id: "copyProtocol", label: siyuanI18n.copyProtocol,
            accelerator: showAccelerator ? keymap.copyProtocol.custom : undefined, focusElement}),
        createCopyItem({ids, type: "protocolMd", id: "copyProtocolInMd", label: siyuanI18n.copyProtocolInMd,
            accelerator: showAccelerator ? keymap.copyProtocolInMd.custom : undefined, focusElement}),
    );
    if (!isElectron) {
        menuItems.push(createCopyItem({
            ids, type: "webURL", id: "copyWebURL", label: siyuanI18n.copyWebURL, accelerator: undefined, focusElement,
        }));
    }
    menuItems.push(
        createCopyItem({ids, type: "hPath", id: "copyHPath", label: siyuanI18n.copyHPath,
            accelerator: showAccelerator ? keymap.copyHPath.custom : undefined, focusElement}),
        createCopyItem({ids, type: "id", id: "copyID", label: siyuanI18n.copyID,
            accelerator: showAccelerator ? keymap.copyID.custom : undefined, focusElement}),
    );

    if (stdMarkdownId) {
        menuItems.push(createMarkdownCopyItem(stdMarkdownId, focusElement));
    }
    return menuItems;
};
