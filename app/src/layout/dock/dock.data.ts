import { 注册类型, 类型可用 } from "./dock.registry";

/** 领域 Dock 可声明的旧布局恢复信息；布局层不需要知道面板实现。 */
export interface DockRecoveryDefinition {
    type: string;
    icon: string;
    title: string;
    position: TDockPosition;
    column: 0 | 1;
    size: Config.IUILayoutDockPanelSize;
    show: boolean;
    hotkey: string;
    hotkeyLangId: string;
}

/**
 * 检查并注册 Dock 项
 * 
 * 作用：去重 dock items，使用全局注册表代替 DOM 查询
 * 用于 array.filter 的回调
 * 
 * @param item dock item 对象
 * @param seen 本次初始化中已看到的类型集合
 * @param standardTypes 标准类型列表
 * @param position 当前 Dock 的位置
 * @同步豁免: UI构建
 */
export function 检查并注册Dock项(
    item: Config.IUILayoutDockTab,
    seen: Set<string>,
    standardTypes: string[],
    position: TDockPosition
): boolean {
    if (!item || !item.type) {
        return false;
    }

    // Normalize type to canonical standard type if it matches case-insensitively
    const lowerType = item.type.toLowerCase();
    const matchedStandard = standardTypes.find(t => t.toLowerCase() === lowerType);

    if (matchedStandard) {
        item.type = matchedStandard;
    }

    // 已在本 dock 数据中出现过（同一 column 或前一 column）
    if (seen.has(item.type)) {
        return false;
    }

    // 使用全局注册表检查并注册类型
    // 如果类型已被其他 Dock 占用，则过滤掉
    if (!注册类型(item.type, position)) {
        return false;
    }

    seen.add(item.type);
    return true;
}

/**
 * 恢复缺失的标准 panel（自愈机制）
 * 使用全局注册表代替 DOM 查询检查是否已存在
 * @param targetArray 目标数组
 * @param existingTypes 本次初始化中已存在的类型
 * @param type 要恢复的类型
 * @param icon 图标
 * @param title 标题
 * @param position 当前 Dock 的位置
 * @同步豁免: UI构建
 */
export function 恢复缺失面板(
    targetArray: Config.IUILayoutDockTab[],
    existingTypes: Set<string>,
    type: string,
    icon: string,
    title: string,
    position: TDockPosition,
    template?: Pick<Config.IUILayoutDockTab, "size" | "show" | "hotkey" | "hotkeyLangId">,
): void {
    // 使用全局注册表检查是否已被其他 Dock 占用
    if (!类型可用(type)) {
        return;
    }

    // 检查当前 dock 的数据中是否已存在
    if (existingTypes.has(type)) {
        return;
    }

    // 尝试注册该类型
    if (!注册类型(type, position)) {
        return;
    }

    const missingTab: Config.IUILayoutDockTab = {
        type,
        icon,
        title,
        size: template ? {...template.size} : {width: 0, height: 0},
        show: template?.show ?? false,
        hotkey: template?.hotkey ?? "",
        hotkeyLangId: template?.hotkeyLangId ?? title,
    };
    targetArray.push(missingTab);
    existingTypes.add(type);
}

/** 按领域声明恢复缺失的内建 Dock，供任意后续内建面板复用。 */
export function 恢复声明的内建面板(
    data: Config.IUILayoutDockTab[][],
    existingTypes: Set<string>,
    position: TDockPosition,
    definitions: readonly DockRecoveryDefinition[],
): void {
    for (const definition of definitions) {
        if (definition.position !== position) {
            continue;
        }
        const target = data[definition.column];
        if (!target) {
            continue;
        }
        恢复缺失面板(
            target,
            existingTypes,
            definition.type,
            definition.icon,
            definition.title,
            position,
            definition,
        );
    }
}



/**
 * 修复旧数据中的 cronjob 图标
 * @同步豁免: UI构建
 */
export function 修复定时任务图标(data: Config.IUILayoutDockTab[][]): void {
    for (const column of data) {
        if (!column) {
            continue;
        }
        for (const item of column) {
            /**
             * 作用：纠正定时任务（Cronjob）的图标。
             * 意图：将旧版数据中错误的 "iconClock" 图标或缺失的图标更新为正确的 "iconHistory"，确保图标显示一致。
             * 生效场景：当遍历到的 Dock 项类型为 "cronjob" 且其图标配置不正确（为 "iconClock" 或为空）时。
             */
            if (item.type === "cronjob" && (item.icon === "iconClock" || !item.icon)) {
                item.icon = "iconHistory";
            }
        }
    }
}


