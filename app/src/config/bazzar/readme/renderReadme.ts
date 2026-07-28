/** 用途：读取 README HTML；使用范围：README 渲染生命周期；解耦评估：子域网关直达网络唯一实现，不复制请求封装。 */
import {fetchPost} from "./imports";
/** 用途：执行 README 内容高亮；使用范围：README 渲染生命周期；解耦评估：子域网关直达 Protyle 高亮唯一实现。 */
import {highlightRender} from "./imports";
/** 用途：构建 README DOM；使用范围：设置页 README 挂载；解耦评估：模板负责唯一 DOM 结构，渲染器只负责生命周期。 */
import {buildReadmeMarkup} from "./markup";

/** 获取 README 内容容器，并在设置页结构缺失时显式报告装配错误。 */
const getReadmeElement = (element: Element) => {
    const readmeElement = element.querySelector("#configBazaarReadme");
    if (!(readmeElement instanceof HTMLElement)) {
        throw new Error("Bazaar README container was not mounted");
    }
    return readmeElement;
};

/** 将已存在的 README HTML 写入内容区域并重新执行 Markdown 高亮。 */
const renderReadmeContent = (readmeElement: HTMLElement, html: string) => {
    const contentElement = readmeElement.querySelector(".item__readme");
    if (!(contentElement instanceof HTMLElement)) {
        throw new Error("Bazaar README content container was not mounted");
    }
    contentElement.innerHTML = html;
    highlightRender(contentElement);
};

/** Bazaar README 的唯一 DOM 呈现实现；读取和设置导航由 openReadme.ts 编排。
 * @同步豁免: UI构建 - 设置页需要在当前 DOM 调用栈中先挂载容器再启动异步内容请求。
 */
export const renderReadme = (request: {
    element: Element;
    bazaarType: TBazaarType;
    data: IBazaarItem;
    downloaded: boolean;
}) => {
    const {element, bazaarType, data, downloaded} = request;
    const readmeElement = getReadmeElement(element);
    readmeElement.innerHTML = buildReadmeMarkup(bazaarType, data, downloaded);
    // 已下载包自带 README 时直接呈现本地内容，避免重复请求。
    if (downloaded && data.preferredReadme) {
        renderReadmeContent(readmeElement, data.preferredReadme);
    }
    // 其它情况必须从 Bazaar API 获取 README HTML。
    if (!downloaded || !data.preferredReadme) {
        fetchPost("/api/bazaar/getBazaarPackageREAME", {
            repoURL: data.repoURL,
            repoHash: data.repoHash,
            packageType: bazaarType,
        }, response => renderReadmeContent(readmeElement, response.data.html));
    }
    readmeElement.classList.add("config-bazaar__readme--show");
};
