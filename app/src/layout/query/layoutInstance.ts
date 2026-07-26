/** 用途：布局树完整领域类型。使用范围：按 ID 查找任意布局实例和选择活动窗口。 */
import type {LayoutDomain} from "./imports";
/** 用途：布局窗口完整领域类型。使用范围：活动窗口收集与比较。 */
import type {LayoutWindow} from "./imports";
/** 用途：布局实例完整联合。使用范围：递归查询输入与返回值。 */
import type {LayoutInstance} from "./layoutInstance.types";
/** 用途：布局窗口遍历唯一实现。使用范围：活动窗口选择。解耦评估：查询与遍历同属无状态布局领域算法，参数传递只会复制既有布局遍历职责。 */
import {collectLayoutWindows} from "./imports";
/** 用途：安全读取当前布局。使用范围：按 ID 查询的缺省中心布局。解耦评估：显式 layout 参数已支持外部注入，环境读取仅保留旧 API 的无参调用语义。 */
import {getSafeSiyuanLayout} from "./imports";

/**
 * 作用：在一棵布局子树中按 ID 深度优先查找实例。
 * 意图：让布局查询只依赖完整领域根，并保持原有遍历顺序。
 * 调用时机：getInstanceById 已取得中心布局或调用方指定布局后。
 * @显式返回类型原因：递归调用需要固定返回联合类型，TypeScript 不能从自引用函数稳定推导。
 */
const findLayoutInstance = (instance: LayoutInstance, id: string): LayoutInstance | undefined => {
    if (instance.id === id) {
        return instance;
    }
    if (!("children" in instance)) {
        return undefined;
    }
    for (const child of instance.children) {
        const result = findLayoutInstance(child, id);
        if (result) {
            return result;
        }
    }
    return undefined;
};

/** @同步豁免: UI构建 - 需要在当前布局操作栈内同步定位实例。 */
export const getInstanceById = (id: string, layout: LayoutDomain | undefined = getSafeSiyuanLayout()?.centerLayout) => {
    return layout ? findLayoutInstance(layout, id) : undefined;
};

/**
 * 作用：按聚焦页签的激活时间比较两个窗口。
 * 意图：保持历史实现只把更新的窗口前移、其余情况维持遍历顺序的排序语义。
 * 调用时机：getWndByLayout 收集完当前布局中的窗口后。
 */
const compareWindowActivity = (a: LayoutWindow, b: LayoutWindow) => {
    const activeElementA = a.element.querySelector(".fn__flex .item--focus");
    const activeElementB = b.element.querySelector(".fn__flex .item--focus");
    const timeA = activeElementA?.getAttribute("data-activetime");
    const timeB = activeElementB?.getAttribute("data-activetime");
    return timeA && timeB && timeA > timeB ? -1 : 0;
};

/** @同步豁免: 需要绝对同步的DOM访问 - 调用方立即使用当前最活跃窗口。 */
export const getWndByLayout = (layout: LayoutDomain) => {
    const windows: LayoutWindow[] = [];
    collectLayoutWindows(layout, windows);
    windows.sort(compareWindowActivity);
    return windows[0];
};
