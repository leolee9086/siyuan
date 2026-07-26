/** 用途：布局导出请求。使用范围：主窗口写入后回调；解耦评估：经 export 网关隔离 Protyle 导出链。 */
import {fetchPost} from "./imports";
/** 用途：窗口模式判断。使用范围：独立窗口导出分支；解耦评估：稳定平台事实。 */
import {isWindow} from "./imports";
/** 用途：保存编辑器滚动位置。使用范围：导出前刷新文档状态；解耦评估：仅导出职责依赖。 */
import {saveScroll} from "./imports";
/** 用途：获取全部编辑器。使用范围：导出前逐一保存滚动；解耦评估：完整 ProtyleDomain 集合查询。 */
import {getAllEditor} from "./imports";
/** 用途：读取配置。使用范围：只读导出门禁；解耦评估：导出组合边界环境事实。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取布局。使用范围：主窗口导出；解耦评估：导出组合边界环境事实。 */
import {getSiyuanLayout} from "./imports";
/** 用途：主窗口快照骨架。使用范围：导出 Dock 状态；解耦评估：共享唯一实现。 */
import {buildMainWindowLayoutJSON} from "./imports";
/** 用途：独立窗口快照。使用范围：sessionStorage 导出；解耦评估：共享唯一实现。 */
import {serializeWindowModeLayout} from "./imports";
/** 用途：递归布局序列化。使用范围：主布局字段；解耦评估：共享唯一算法。 */
import {layoutToJSON} from "./imports";
/** 用途：布局 JSON。使用范围：导出请求；解耦评估：纯类型依赖。 */
import type {SerializationJSON} from "./imports";

/** 保存编辑器状态后导出当前布局。 */
export const exportLayout = async (options: {cb: () => void; errorExit: boolean}) => {
    for (const editor of getAllEditor()) {
        await saveScroll(editor.protyle);
    }
    // 独立窗口只更新自己的 sessionStorage，不写主窗口布局配置。
    if (isWindow()) {
        sessionStorage.setItem("layout", JSON.stringify(serializeWindowModeLayout()));
        options.cb();
        return;
    }
    const result = buildMainWindowLayoutJSON();
    if (!result) {
        options.cb();
        return;
    }
    const layout = getSiyuanLayout()?.layout;
    if (layout) {
        const data: SerializationJSON = {};
        result.layout = data;
        layoutToJSON(layout, data);
    }
    // 只读模式完成滚动保存和快照构建后直接通知调用方，不向内核写入。
    if (getSiyuanConfig()?.readonly) {
        options.cb();
        return;
    }
    fetchPost("/api/system/setUILayout", {layout: result, errorExit: options.errorExit}, options.cb);
};
