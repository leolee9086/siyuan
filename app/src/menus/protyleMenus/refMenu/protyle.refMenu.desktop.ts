/** 用途：读取流程常量；使用范围：open/refTab/分屏动作数组；解耦评估：常量集中维护避免魔法值。 */
import { Constants } from "./imports";
/** 用途：执行折叠检查；使用范围：桌面端打开类动作；解耦评估：折叠兼容逻辑在工具层统一。 */
import { checkFold } from "./imports";
/** 用途：打开文档；使用范围：openBy/refTab/right/bottom；解耦评估：文档打开能力统一入口。 */
import { openFileById } from "./imports";
/** 用途：读取国际化文案；使用范围：桌面菜单项 label；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：读取快捷键展示工具；使用范围：accelerator 拼接；解耦评估：展示规则集中维护。 */
import { updateHotkeyTip } from "./imports";
/** 用途：读取系统配置；使用范围：快捷键配置读取；解耦评估：配置读取由环境层封装。 */
import { getSiyuanConfig } from "./imports";
/** 用途：菜单项构造器；使用范围：桌面端动作项创建；解耦评估：组件能力统一维护。 */
import { MenuItem } from "./imports";
/** 用途：读取菜单容器；使用范围：追加桌面端菜单项；解耦评估：菜单单例由环境层管理。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：判断 Electron 环境；使用范围：是否展示新窗口打开；解耦评估：平台判断集中在平台层。 */
import { isElectron } from "./imports";
/** 用途：新窗口打开文档；使用范围：openByNewWindow 动作；解耦评估：窗口能力独立封装。 */
import { openNewWindowById } from "./imports";
/** 用途：打开反链面板；使用范围：backlinks 动作；解耦评估：面板能力独立封装。 */
import { openBacklink } from "./imports";
/** 用途：打开图谱面板；使用范围：graphView 动作；解耦评估：面板能力独立封装。 */
import { openGraph } from "./imports";

/** 从菜单数据获取已勾选的 ID 列表，未勾选时返回全部 */
const 获取选中IDs = (fallback: string[]): string[] => {
    const selected = (getSiyuanGlobalMenus().menu as any).selectedTargetIds as Set<string> | undefined;
    if (selected && selected.size > 0) {
        return Array.from(selected);
    }
    return fallback;
};

/**
 * 作用：创建桌面端普通打开回调（当前页/右侧/下侧）。
 * 意图：把 openBy / insertRight / insertBottom 的共同打开逻辑收敛到同一入口。
 * 调用时机：构建对应菜单项 click 时传给 `checkFold`。
 * 问题/改进：`action` 直接在原数组上 push，后续可评估改为不可变写法以降低副作用风险。
 */
const 创建普通打开回调 = (protyle: IProtyle, refBlockIds: string[], position?: "right" | "bottom") => {
    return (zoomIn: boolean, action: string[], isRoot: boolean) => {
        if (!isRoot) {
            action.push(Constants.CB_GET_HL);
        }
        // 多 ID 时仅打开首个目标
        openFileById({
            app: protyle.app,
            id: refBlockIds[0],
            position,
            action,
            zoomIn
        });
    };
};

const 创建RefTab回调 = (protyle: IProtyle, refBlockIds: string[]) => {
    return (zoomIn: boolean) => {
        openFileById({
            app: protyle.app,
            id: refBlockIds[0],
            action: zoomIn
                ? [Constants.CB_GET_HL, Constants.CB_GET_ALL]
                : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
            keepCursor: true,
            zoomIn
        });
    };
};




/**
 * 作用：读取 insertBottom 菜单展示的快捷键文本。
 * 意图：把 “有 custom 才拼接斜杠” 的规则集中，避免重复访问配置和拼接表达式过长。
 * 调用时机：创建 `insertBottom` 菜单项时。
 * 问题/改进：若未来展示规则变化，应统一在该函数调整。
 */
const 读取插入到底部快捷键 = (): string => {
    const insertBottomHotkey = getSiyuanConfig().keymap.editor.general.insertBottom.custom;
    return insertBottomHotkey
        ? insertBottomHotkey + "/" + updateHotkeyTip("⇧" + siyuanI18n.click)
        : updateHotkeyTip("⇧" + siyuanI18n.click);
};

/**
 * 作用：构建桌面端“打开方式”相关菜单项。
 * 意图：把 openBy/refTab/分屏/新窗口 这类动作分组，降低主导出函数行数和认知负担。
 * 调用时机：`追加桌面端引用菜单项` 的前半段。
 * 问题/改进：当前仍依赖固定顺序，后续可改为配置化排序。
 */
const 构建打开方式菜单项列表 = (protyle: IProtyle, refBlockIds: string[]): MenuItem[] => {
    const primaryId = refBlockIds[0] || "";
    const menuItems: MenuItem[] = [];
    menuItems.push(new MenuItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: "iconOpen",
        accelerator: getSiyuanConfig().keymap.editor.general.openBy.custom + "/" + siyuanI18n.click,
        click: checkFold.bind(null, primaryId, 创建普通打开回调(protyle, refBlockIds))
    }));
    menuItems.push(new MenuItem({
        id: "refTab",
        label: siyuanI18n.refTab,
        icon: "iconEyeoff",
        accelerator: getSiyuanConfig().keymap.editor.general.refTab.custom + "/" + updateHotkeyTip("⌘" + siyuanI18n.click),
        click: checkFold.bind(null, primaryId, 创建RefTab回调(protyle, refBlockIds))
    }));
    menuItems.push(new MenuItem({
        id: "insertRight",
        label: siyuanI18n.insertRight,
        icon: "iconLayoutRight",
        accelerator: getSiyuanConfig().keymap.editor.general.insertRight.custom + "/" + updateHotkeyTip("⌥" + siyuanI18n.click),
        click: checkFold.bind(null, primaryId, 创建普通打开回调(protyle, refBlockIds, "right"))
    }));
    menuItems.push(new MenuItem({
        id: "insertBottom",
        label: siyuanI18n.insertBottom,
        icon: "iconLayoutBottom",
        accelerator: 读取插入到底部快捷键(),
        click: checkFold.bind(null, primaryId, 创建普通打开回调(protyle, refBlockIds, "bottom"))
    }));
    if (isElectron) {
        menuItems.push(new MenuItem({
            id: "openByNewWindow",
            label: siyuanI18n.openByNewWindow,
            icon: "iconOpenWindow",
            click: openNewWindowById.bind(null, primaryId)
        }));
    }
    return menuItems;
};

const 构建关系面板菜单项列表 = (protyle: IProtyle, refBlockIds: string[]): MenuItem[] => {
    const primaryId = refBlockIds[0] || "";
    const menuItems: MenuItem[] = [];
    menuItems.push(new MenuItem({ id: "separator_2", type: "separator" }));
    menuItems.push(new MenuItem({
        id: "backlinks",
        icon: "iconLink",
        label: siyuanI18n.backlinks,
        accelerator: getSiyuanConfig().keymap.editor.general.backlinks.custom,
        click: openBacklink.bind(null, {
            app: protyle.app,
            blockId: primaryId,
        })
    }));
    menuItems.push(new MenuItem({
        id: "graphView",
        icon: "iconGraph",
        label: siyuanI18n.graphView,
        accelerator: getSiyuanConfig().keymap.editor.general.graphView.custom,
        click: openGraph.bind(null, {
            app: protyle.app,
            blockId: primaryId,
        })
    }));
    menuItems.push(new MenuItem({ id: "separator_3", type: "separator" }));
    return menuItems;
};

/**
 * 作用：把菜单项数组顺序追加到全局菜单容器。
 * 意图：复用 append 过程，避免主流程中重复 `menu.append(new MenuItem(...).element)` 模板代码。
 * 调用时机：各菜单分组构建完成后统一调用。
 * 问题/改进：目前只处理 append，后续若引入插入位置可扩展为策略参数。
 */
const 追加菜单项列表 = (menuItems: MenuItem[]): void => {
    for (const item of menuItems) {
        getSiyuanGlobalMenus().menu.append(item.element);
    }
};

/**
 * 作用：追加桌面端引用菜单项。
 * 意图：把桌面打开类动作从主流程拆出，降低主函数复杂度。
 * 调用时机：`!isMobile` 分支。
 * 问题/改进：当前顺序仍硬编码，后续可抽象成配置驱动。
 */
/** @同步豁免: UI构建 */
export const 追加桌面端引用菜单项 = (protyle: IProtyle, refBlockIds: string[]): void => {
    const 打开方式菜单项列表 = 构建打开方式菜单项列表(protyle, refBlockIds);
    追加菜单项列表(打开方式菜单项列表);
    const 关系面板菜单项列表 = 构建关系面板菜单项列表(protyle, refBlockIds);
    追加菜单项列表(关系面板菜单项列表);
};
