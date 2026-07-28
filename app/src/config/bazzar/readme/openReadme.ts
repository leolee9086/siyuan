/** 用途：读取 Bazaar API；使用范围：README URI 编排；解耦评估：子域网关直达网络唯一实现，不复制请求封装。 */
import {fetchSyncPost} from "./imports";
/** 用途：读取前端平台标识；使用范围：README 查询参数；解耦评估：子域网关直达统一平台实现。 */
import {getFrontend} from "./imports";
/** 用途：判断移动宿主；使用范围：README URI 桌面入口；解耦评估：子域网关直达平台分派实现。 */
import {isMobile} from "./imports";
/** 用途：显示资源缺失通知；使用范围：README 查询反馈；解耦评估：子域网关直达公共消息实现。 */
import {showMessage} from "./imports";
/** 用途：转义资源名称；使用范围：README 缺失消息；解耦评估：子域网关直达公共安全工具。 */
import {escapeHtml} from "./imports";
/** 用途：完整 AppFacade 类型；使用范围：README 设置导航；解耦评估：仅类型依赖，不加载 App 实现。 */
import type {AppFacade} from "./imports";
/** 用途：呈现 README DOM；使用范围：设置页挂载；解耦评估：复用同域唯一呈现实现，不复制 HTML。 */
import {renderReadme} from "./renderReadme";

/** 根据来源和包类型选择唯一 Bazaar 查询地址，不保存跨调用状态。 */
const getBazaarResourcesURL = (from: "bazaar" | "downloaded", bazaarType: TBazaarType) => {
    if (from === "bazaar") {
        return {
            templates: "/api/bazaar/getBazaarTemplate",
            icons: "/api/bazaar/getBazaarIcon",
            widgets: "/api/bazaar/getBazaarWidget",
            themes: "/api/bazaar/getBazaarTheme",
            plugins: "/api/bazaar/getBazaarPlugin",
        }[bazaarType];
    }
    return {
        templates: "/api/bazaar/getInstalledTemplate",
        icons: "/api/bazaar/getInstalledIcon",
        widgets: "/api/bazaar/getInstalledWidget",
        themes: "/api/bazaar/getInstalledTheme",
        plugins: "/api/bazaar/getInstalledPlugin",
    }[bazaarType];
};

/** 从 URI 打开 Bazaar README；设置页导航由完整 AppFacade 负责。 */
export const openBazaarReadme = async (request: {
    app: AppFacade;
    bazaarType: TBazaarType;
    itemName: string;
    from?: "bazaar" | "downloaded";
}) => {
    const {app, bazaarType, itemName, from = "bazaar"} = request;
    if (isMobile) {
        return;
    }
    // 配置尚未完成或未信任社区集市时只打开设置页，不发起包内容请求。
    const config = window.siyuan.config;
    // 配置缺失或未授权时维持原行为，先让用户在设置页明确启用社区集市。
    if (!config || !config.bazaar.trust) {
        app.openSettings("bazaar");
        return;
    }
    const getResourcesUrl = getBazaarResourcesURL(from, bazaarType);
    const response = await fetchSyncPost(getResourcesUrl, {
        frontend: getFrontend(),
        keyword: itemName,
    });
    if (response.code !== 0) {
        return;
    }
    const resource = response.data.packages.find((item: IBazaarItem) => item.name === itemName);
    if (!resource) {
        showMessage(`Package not found: ${escapeHtml(itemName)}`);
        return;
    }

    app.openSettings("bazaar");
    const dialog = window.siyuan.dialogs.find(item => item.element.querySelector(".config__tab-container"));
    if (!dialog) {
        throw new Error("Bazaar settings dialog was not mounted by the application host");
    }
    renderReadme({element: dialog.element, bazaarType, data: resource, downloaded: from === "downloaded"});
};
