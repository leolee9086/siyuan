/** 用途：Dock 挂载的完整布局领域根。使用范围：Dock 布局初始化，不加载具体 Layout class。 */
import type {LayoutDomain} from "../../layout.types";
/** 导出完整布局领域根，供布局初始化使用。 */
export type {LayoutDomain};

/** 用途：异构布局树的领域守卫。使用范围：Dock 方位解析；解耦评估：直接转发唯一守卫实现，避免具体 Layout class 与断言。 */
import {isLayoutDomain} from "../../layout.types.guard";
/** 导出布局领域守卫，供布局初始化使用。 */
export {isLayoutDomain};

/** 用途：正在初始化的完整 Dock 聚合根。使用范围：写入布局、分隔条和样式。 */
import type {DockDomain} from "../dock.types";
/** 导出完整 Dock 聚合根，供布局初始化使用。 */
export type {DockDomain};
