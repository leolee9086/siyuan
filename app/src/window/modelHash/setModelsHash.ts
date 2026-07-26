/** 用途：窗口模式判断。使用范围：只为独立窗口持久化布局 hash；解耦评估：稳定平台事实，不加载 Window UI 实现。 */
import {isWindow} from "./imports";
/** 用途：hash 分隔常量。使用范围：保持现有多模型 hash 格式；解耦评估：协议常量属于稳定共享依赖。 */
import {Constants} from "./imports";
/** 用途：写入地址 hash。使用范围：模型身份序列化完成后的唯一环境副作用；解耦评估：环境适配已独立，继续参数传递只会扩散浏览器生命周期职责。 */
import {setLocationHash} from "./imports";
/** 用途：读取当前中心布局。使用范围：收集独立窗口页签；解耦评估：缺省全局布局是该无参公共 API 的既有语义。 */
import {getSiyuanLayout} from "./imports";
/** 用途：读取模型声明的窗口恢复身份。使用范围：排除不参与 hash 的布局模型；解耦评估：同一 modelHash 领域的稳定守卫。 */
import {readWindowHashIdentity} from "./readWindowHashIdentity";
/** 用途：遍历完整布局页签。使用范围：保持原有布局顺序生成 hash；解耦评估：稳定遍历算法不加载 Layout/Tab class。 */
import {collectLayoutTabs} from "./imports";
/** 用途：页签遍历领域类型。使用范围：hash 序列化输入；解耦评估：纯类型依赖不加载具体 Tab。 */
import type {ILayoutTraversalTab} from "./imports";

/** 从尚未初始化的 Editor 页签数据恢复文档根身份。 */
const getHashFromInitData = (headElement: HTMLElement) => {
    const initTab = headElement.getAttribute("data-initdata");
    if (!initTab) {
        return "";
    }
    const initTabData = JSON.parse(initTab);
    if (initTabData.instance !== "Editor") {
        return "";
    }
    return initTabData.rootId + Constants.ZWSP;
};

/** 将一个页签的当前模型身份序列化为窗口 hash 片段。 */
const processTabForHash = (tab: ILayoutTraversalTab) => {
    if (!tab.model) {
        return getHashFromInitData(tab.headElement);
    }
    const identity = readWindowHashIdentity(tab.model);
    return identity ? identity.value + Constants.ZWSP : "";
};

/**
 * 将独立窗口当前全部页签身份同步到 URL hash。
 * @同步豁免: 生命周期 - 页签切换、关闭和 PDF 初始化完成后必须在当前调用栈内持久化窗口恢复状态。
 */
export const setModelsHash = () => {
    if (!isWindow()) {
        return;
    }
    const layout = getSiyuanLayout().centerLayout;
    if (!layout) {
        return;
    }
    const tabs: ILayoutTraversalTab[] = [];
    collectLayoutTabs(layout, tabs);
    setLocationHash(tabs.map(processTabForHash).join(""));
};
