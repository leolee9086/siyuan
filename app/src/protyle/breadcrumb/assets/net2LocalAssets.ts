/** 用途：添加资源下载加载态；使用范围：请求开始；解耦评估：经专属网关直达唯一 UI 实现。 */
import {addLoading} from "./imports";
/** 用途：发送资源下载请求；使用范围：网络资源本地化；解耦评估：经专属网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：查询同根编辑器；使用范围：下载完成刷新；解耦评估：经专属网关直达 Layout 查询。 */
import {getAllEditor} from "./imports";
/** 用途：隐藏编辑工具栏；使用范围：请求开始；解耦评估：经专属网关直达唯一 UI 实现。 */
import {hideElements} from "./imports";
/** 用途：移动平台判断；使用范围：选择刷新范围；解耦评估：经专属网关直达平台事实。 */
import {isMobile} from "./imports";
/** 用途：刷新编辑器；使用范围：下载完成；解耦评估：经专属网关直达唯一行为。 */
import {reloadProtyle} from "./imports";

/** 刷新同根文档的全部编辑器实例。 */
function refreshLocalizedAssets(protyle: IProtyle) {
    if (isMobile) {
        reloadProtyle(protyle, false);
        return;
    }
    for (const item of getAllEditor()) {
        // 资源 URL 只影响同一根文档，其他已打开文档无需重载。
        if (item.protyle.block.rootID === protyle.block.rootID) {
            reloadProtyle(item.protyle, item.protyle.element === protyle.element);
        }
    }
}

/** 下载网络资源并在完成后刷新同根编辑器。 @同步豁免: UI构建 */
export const net2LocalAssets = (protyle: IProtyle, type: "Assets" | "Img") => {
    if (protyle.element.querySelector(".wysiwygLoading")) {
        return;
    }
    addLoading(protyle);
    hideElements(["toolbar"], protyle);
    fetchPost(`/api/format/net${type}2LocalAssets`, {id: protyle.block.rootID}, () => {
        refreshLocalizedAssets(protyle);
    });
};
