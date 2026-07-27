/** 用途：请求无效引用分页数据；使用范围：移动无效引用面板；解耦评估：经本域网关直达网络基础设施。 */
import {fetchPost} from "./imports";
/** 用途：呈现块类型图标；使用范围：无效引用结果项；解耦评估：经本域网关直达无状态映射。 */
import {getIconByType} from "./imports";
/** 用途：呈现文档路径；使用范围：无效引用结果元数据；解耦评估：经本域网关直达纯路径算法。 */
import {getDisplayName} from "./imports";
/** 用途：呈现笔记本名称；使用范围：无效引用结果元数据；解耦评估：经本域网关直达纯路径算法。 */
import {getNotebookName} from "./imports";
/** 用途：转义结果路径；使用范围：无效引用列表 HTML；解耦评估：经本域网关直达共享纯算法。 */
import {escapeHtml} from "./imports";
/** 用途：呈现块 Emoji；使用范围：无效引用结果项；解耦评估：经本域网关直达唯一实现。 */
import {unicode2Emoji} from "./imports";
/** 用途：移动搜索文案；使用范围：结果统计与空状态；解耦评估：经本域网关直达只读环境。 */
import {siyuanI18n} from "./imports";

/** 打开移动搜索的无效引用面板，并在首次打开时加载第一页。 @同步豁免: UI构建 - 菜单点击后必须立即切换既有移动面板 DOM。 */
export const goUnRef = () => {
    const menu = window.siyuan.menus?.menu;
    if (!menu) {
        throw new Error("Invalid reference search requires an initialized menu runtime");
    }
    menu.remove();
    const unRefElement = document.querySelector("#searchUnRefPanel");
    if (!unRefElement) {
        throw new Error("Invalid reference search panel is not initialized");
    }
    unRefElement.classList.remove("fn__none");
    const listElement = unRefElement.querySelector("#searchUnRefList");
    if (!listElement || listElement.innerHTML) {
        return;
    }
    getUnRefListMobile(unRefElement);
};

/** 将无效引用响应投影到移动分页面板，保持列表、统计和下一页状态一致。 */
const renderInvalidRefsPage = (element: Element, page: number, response: IWebSocketData) => {
    const loadingElement = element.parentElement?.querySelector(".fn__loading");
    loadingElement?.classList.add("fn__none");
    const nextElement = element.querySelector('[data-type="unRefNext"]');
    nextElement?.toggleAttribute("disabled", page >= response.data.pageCount);
    let resultHTML = "";
    for (let index = 0; index < response.data.blocks.length; index++) {
        const item: IBlock = response.data.blocks[index];
        const {box, hPath, id, type} = item;
        if (!box || hPath === undefined || !id || !type) {
            throw new Error("Invalid reference search result is missing block identity fields");
        }
        const title = escapeHtml(getNotebookName(box)) + getDisplayName(hPath, false);
        resultHTML += `<div class="b3-list-item b3-list-item--two${index === 0 ? " b3-list-item--focus" : ""}" data-type="search-item" data-node-id="${item.id}">
<div class="b3-list-item__first">
    <svg class="b3-list-item__graphic"><use xlink:href="#${getIconByType(type)}"></use></svg>
    ${unicode2Emoji(item.ial?.icon || "", "b3-list-item__graphic", true)}
    <span class="b3-list-item__text">${item.content}</span>
</div>
<span class="b3-list-item__text b3-list-item__meta">${escapeHtml(title)}</span>
</div>`;
    }
    const resultElement = element.querySelector("#searchUnRefResult");
    const listElement = element.querySelector("#searchUnRefList");
    if (!resultElement || !listElement) {
        throw new Error("Invalid reference search result DOM is incomplete");
    }
    resultElement.innerHTML = `<span class="fn__flex-center">${siyuanI18n.findInDoc.replace("${x}", response.data.matchedRootCount).replace("${y}", response.data.matchedBlockCount)}</span>
<span class="fn__flex-1"></span>
<span class="fn__flex-center">${page}/${response.data.pageCount || 1}</span>`;
    listElement.innerHTML = resultHTML || `<div class="search__empty">${siyuanI18n.emptyContent}</div>`;
};

/** 加载并呈现移动无效引用列表指定页，保持分页按钮与统计同步。 @同步豁免: 生命周期 - 事件处理器依赖该函数立即发起请求且不等待网络完成。 */
export const getUnRefListMobile = (element: Element, page = 1) => {
    const previousElement = element.querySelector('[data-type="unRefPrevious"]');
    previousElement?.toggleAttribute("disabled", page <= 1);
    fetchPost("/api/search/listInvalidBlockRefs", {page}, renderInvalidRefsPage.bind(undefined, element, page));
};
