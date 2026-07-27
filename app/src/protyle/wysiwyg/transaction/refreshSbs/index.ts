/** 用途：刷新超级块拖拽手柄。使用范围：事务删除、移动、插入、折叠和块转换后刷新相关超级块。解耦评估：该操作必须调用块工具里的 DOM 手柄重建逻辑，抽到事务共享 helper 后可避免各事务模块重复依赖具体实现。 */
import {refreshSbResize} from "./imports";

/**
 * 作用：刷新一组元素所在超级块的拖拽手柄。
 * 意图：事务可能同时影响源超级块和目标超级块，集中去重可避免重复刷新和遗漏已脱离 DOM 的元素。
 * 调用时机：块删除、移动、插入、折叠展开或块转换完成后调用。
 * 问题/改进：如果后续有新的超级块装饰元素，应继续保持这里只按真实超级块容器刷新。
 * @同步豁免: 需要绝对同步的DOM访问 - 事务已修改 DOM 后必须立即重建手柄，避免后续选择和拖拽命中旧节点。
 */
export const refreshSbs = (...elements: Array<Element | null | undefined>) => {
    const sbs = new Set<Element>();
    for (const element of elements) {
        if (!element) {
            continue;
        }
        const sbElement = element.closest('[data-type="NodeSuperBlock"]');
        // 只刷新仍挂在文档中的超级块，避免对已被删除的源节点重建手柄。
        if (sbElement?.parentElement) {
            sbs.add(sbElement);
        }
    }
    for (const sbElement of sbs) {
        refreshSbResize(sbElement);
    }
};
