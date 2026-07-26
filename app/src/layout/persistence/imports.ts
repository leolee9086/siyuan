/** 用途：完整布局领域根。使用范围：布局递归序列化。解耦评估：纯类型依赖。 */
import type {LayoutDomain, LayoutTab, LayoutWindow} from "../layout.types";
/** 导出布局容器领域根。 */
export type {LayoutDomain};
/** 导出布局页签领域根。 */
export type {LayoutTab};
/** 导出布局窗口领域根。 */
export type {LayoutWindow};

/** 用途：布局领域守卫。使用范围：序列化分派。解耦评估：稳定抽象身份。 */
import {isLayoutDomain, isLayoutTab, isLayoutWindow} from "../layout.types.guard";
/** 导出布局容器守卫。 */
export {isLayoutDomain};
/** 导出布局页签守卫。 */
export {isLayoutTab};
/** 导出布局窗口守卫。 */
export {isLayoutWindow};

/** 用途：布局模型根。使用范围：模型序列化输入。解耦评估：稳定生命周期契约。 */
import type {ILayoutModel} from "../lifecycle/model.types";
/** 导出布局模型根。 */
export type {ILayoutModel};

/** 用途：模型字段序列化。使用范围：布局递归算法。解耦评估：已改用领域守卫，不加载具体模型 class。 */
import {serializeInstance} from "../layout-serialization.serializers";
/** 导出模型字段序列化。 */
export {serializeInstance};

/** 用途：布局 JSON 数据类型。使用范围：保存、快照和递归算法。解耦评估：纯类型依赖。 */
import type {BreakObject, SerializationJSON} from "../layout-serialization.types";
/** 导出布局中断状态类型。 */
export type {BreakObject};
/** 导出布局 JSON 类型。 */
export type {SerializationJSON};

/** 用途：Dock DOM 序列化。使用范围：布局快照。解耦评估：依赖完整 DockDomain 的唯一实现。 */
import {dockToJSON} from "../dock/persistence/dockSerialization";
/** 导出 Dock 序列化。 */
export {dockToJSON};

/** 用途：读取配置、布局并调度窗口计时器。使用范围：快照和保存。解耦评估：持久化组合边界的环境事实。 */
import {getSiyuanConfig, getSiyuanLayout, setWindowTimeout} from "../dock/dock.environment";
/** 导出配置读取。 */
export {getSiyuanConfig};
/** 导出布局读取。 */
export {getSiyuanLayout};
/** 导出窗口计时器。 */
export {setWindowTimeout};

/** 用途：布局保存请求。使用范围：普通保存。解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};

/** 用途：窗口模式判断。使用范围：选择保存介质。解耦评估：稳定平台事实。 */
import {isWindow} from "../../util/platform/functions";
/** 导出窗口模式判断。 */
export {isWindow};

/** 用途：保存重试间隔。使用范围：未初始化 Editor 门禁。解耦评估：稳定协议常量。 */
import {Constants} from "../../constants";
/** 导出协议常量。 */
export {Constants};
