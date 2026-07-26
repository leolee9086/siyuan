/** 用途：布局保存请求。使用范围：主窗口持久化；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "./imports";
/** 用途：窗口模式判断。使用范围：选择 sessionStorage 或后端；解耦评估：稳定平台事实。 */
import {isWindow} from "./imports";
/** 用途：重试间隔。使用范围：未初始化 Editor 延迟保存；解耦评估：稳定协议常量。 */
import {Constants} from "./imports";
/** 用途：读取配置/布局并调度重试。使用范围：保存编排；解耦评估：环境事实集中在 persistence 边界。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取当前布局。使用范围：主窗口保存；解耦评估：持久化组合边界的环境事实。 */
import {getSiyuanLayout} from "./imports";
/** 用途：窗口计时器。使用范围：未初始化 Editor 有限重试；解耦评估：保留原生命周期调度语义。 */
import {setWindowTimeout} from "./imports";
/** 用途：保存所需布局快照。使用范围：主窗口与独立窗口分支；解耦评估：同一持久化领域。 */
import {buildMainWindowLayoutJSON} from "./layoutSnapshot";
/** 用途：独立窗口布局快照。使用范围：sessionStorage 保存；解耦评估：同一持久化领域唯一实现。 */
import {serializeWindowModeLayout} from "./layoutSnapshot";
/** 用途：递归序列化主布局。使用范围：保存快照 layout 字段；解耦评估：同一持久化领域唯一算法。 */
import {layoutToJSON} from "./layoutSerializer";
/** 用途：保存 JSON 与未初始化状态。使用范围：重试门禁；解耦评估：纯数据类型。 */
import type {BreakObject} from "./imports";
/** 用途：布局 JSON。使用范围：持久化写入；解耦评估：纯数据类型。 */
import type {SerializationJSON} from "./imports";
/** 用途：读取统一保存重试状态。使用范围：十次重试门禁；解耦评估：注册表集中拥有跨调用方状态。 */
import {getLayoutSaveRetryCount} from "./state/saveLayout.registry";
/** 用途：递增统一保存重试状态。使用范围：调度下次保存前；解耦评估：注册表集中变更。 */
import {incrementLayoutSaveRetryCount} from "./state/saveLayout.registry";
/** 用途：清零统一保存重试状态。使用范围：保存完成或终止重试后；解耦评估：注册表集中变更。 */
import {resetLayoutSaveRetryCount} from "./state/saveLayout.registry";

/** 构建主窗口保存数据并同步当前配置镜像。 */
const serializeMainWindowLayout = (breakObj: BreakObject) => {
    const result = buildMainWindowLayoutJSON();
    const layout = getSiyuanLayout()?.layout;
    if (!result || !layout) {
        return null;
    }
    const data: SerializationJSON = {};
    result.layout = data;
    layoutToJSON(layout, data, breakObj);
    const config = getSiyuanConfig();
    if (config) {
        Object.assign(config.uiLayout, result);
    }
    return result;
};

/** 写入当前宿主对应的布局存储。 */
const persistLayout = (layout: SerializationJSON, windowMode: boolean) => {
    if (windowMode) {
        sessionStorage.setItem("layout", JSON.stringify(layout));
        return;
    }
    // 只读模式保留原有无写入语义，其余状态提交布局到内核。
    if (!getSiyuanConfig()?.readonly) {
        fetchPost("/api/system/setUILayout", {layout, errorExit: false});
    }
};

/** 保存当前布局并保持未初始化 Editor 的既有有限重试语义。 @同步豁免: 生命周期 */
/** 保存当前布局并通过统一注册表保持未初始化 Editor 的既有有限重试语义。 @同步豁免: 生命周期 */
export const saveLayout = () => {
    const breakObj: BreakObject = {};
    const windowMode = isWindow();
    const layout = windowMode ? serializeWindowModeLayout(breakObj) : serializeMainWindowLayout(breakObj);
    if (!layout) {
        return;
    }
    const retryCount = getLayoutSaveRetryCount();
    // Editor 尚未完成初始化时按原间隔有限重试，避免持久化空文档身份。
    if (Object.keys(breakObj).length > 0 && retryCount < 10) {
        const nextRetryCount = incrementLayoutSaveRetryCount();
        setWindowTimeout(saveLayout, Constants.TIMEOUT_LOAD * nextRetryCount);
        return;
    }
    resetLayoutSaveRetryCount();
    persistLayout(layout, windowMode);
};
