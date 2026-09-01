/** 用途：为 Tree 节点选择既有图标；使用范围：Tree 项和块项渲染；解耦评估：图标规则属于编辑器共享表现语义，参数注入会复制规则所有权。 */
import {getIconByType} from "./imports";
/** 用途：渲染文档块的自定义 emoji；使用范围：非大纲文档块；解耦评估：复用统一 emoji 渲染器可保持编码语义一致。 */
import {unicode2Emoji} from "./imports";
/** 用途：读取本地图标存储键；使用范围：文档块默认图标；解耦评估：常量无状态且是存储协议的一部分，不应由宿主重复传入。 */
import {Constants} from "./imports";
/** 用途：转义 Tree 提示文本；使用范围：反链和大纲 aria-label；解耦评估：共享转义边界应保持唯一实现。 */
import {escapeAriaLabel} from "./imports";
/** 用途：转义大纲序号文本；使用范围：大纲序号 HTML；解耦评估：共享转义边界应保持唯一实现。 */
import {escapeHtml} from "./imports";
/** 用途：判定大纲序号后是否需要间距修正；使用范围：大纲序号渲染；解耦评估：标题编号共享表现语义。 */
import {headingNumberNeedsSpacing} from "./imports";
/** 用途：保留桌面与移动 Tree 的既有间距和动作样式；使用范围：本渲染模块；解耦评估：平台检测是现有统一运行时能力，宿主参数会造成状态分叉。 */
import {isMobile} from "./imports";
/** 用途：约束内核块渲染投影；使用范围：本模块；边界：仅类型依赖。 */
import type {TreeBlockData} from "./imports";
/** 用途：约束官方块数据兼容分支；使用范围：块列表输入；边界：仅类型依赖。 */
import type {IBlock} from "./imports";
/** 用途：约束完整递归 Tree 输入；使用范围：分组和块列表递归；边界：仅类型依赖。 */
import type {TreeNodeData} from "./imports";
/** 用途：在块渲染边界验证内核载荷；使用范围：每个 Tree 块项；解耦评估：校验规则与渲染投影同域，应在此复用而非由宿主承担。 */
import {isTreeBlockData} from "./treeBlock.guard";
/** 用途：约束 Tree 渲染阶段的字段投影；使用范围：本模块所有模板函数；边界：本域实现类型。 */
import type {TreeRenderOptions} from "./tree.render.types";

/** 生成单个 Tree 项的既有缩进样式；每次渲染桌面或移动列表项时调用。 */
const getItemStyle = (depth: number) => {
    if (isMobile()) {
        return depth > 0 ? `padding-left: ${(depth - 1) * 20 + 24}px` : "";
    }
    return `padding-left: ${depth * 18 || 4}px;margin-right: 2px`;
};

/** 生成大纲序号 HTML；空序号返回空串，全角标点结尾的序号按共享规则省略间距。 */
const genOutlineNumberHTML = (number?: string) => {
    if (!number) {
        return "";
    }
    const spacingClass = headingNumberNeedsSpacing(number) ? "" : " b3-list-item__number--no-spacing";
    return `<span class="b3-list-item__number${spacingClass}">${escapeHtml(number)}</span>`;
};

/** 根据 Tree 项领域类型选择图标和可访问提示；渲染每个分组项前调用。 */
const renderTreeIcon = (item: TreeNodeData) => {
    // 书签和标签拥有固定的领域图标，不读取通用节点图标。
    if (item.type === "bookmark") {
        return {
            iconHTML: '<svg class="b3-list-item__graphic"><use xlink:href="#iconBookmark"></use></svg>',
            titleTip: "",
        };
    }
    if (item.type === "tag") {
        return {
            iconHTML: '<svg class="b3-list-item__graphic"><use xlink:href="#iconTags"></use></svg>',
            titleTip: "",
        };
    }
    // 反向链接使用人类可读路径作为提示，并保留块预览所需的数据标识。
    if (item.type === "backlink") {
        return {
            iconHTML: `<svg class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.nodeType, item.subType)}"></use></svg>`,
            titleTip: ` aria-label="${escapeAriaLabel(item.hPath)}"`,
        };
    }
    // 大纲提示需要先把 BlockDOM 标题还原为可读文本。
    if (item.type === "outline") {
        return {
            iconHTML: `<svg class="b3-list-item__graphic popover__block" data-id="${item.id}" style="height: 22px;width: 10px;"><use xlink:href="#${getIconByType(item.nodeType, item.subType)}"></use></svg>`,
            titleTip: ` aria-label="${escapeAriaLabel(Lute.BlockDOM2Content(item.name))}"`,
        };
    }
    return {
        iconHTML: `<svg class="b3-list-item__graphic"><use xlink:href="#${item.icon || "iconFolder"}"></use></svg>`,
        titleTip: "",
    };
};

/** 生成一个分组项 LI，保持旧 Tree 的属性、扩展区和计数顺序。 */
const renderTreeItem = (item: TreeNodeData, options: TreeRenderOptions) => {
    const {iconHTML, titleTip} = renderTreeIcon(item);
    const hasChild = !!((item.children && item.children.length > 0) || (item.blocks && item.blocks.length > 0));
    const showArrow = item.showArrow || hasChild ||
        ((item.type === "backlink" || item.type === "bookmark" || item.type === "tag") && !isMobile());
    const countHTML = item.count ? `<span class="counter">${item.count}</span>` : "";
    const numberHTML = item.type === "outline" ? genOutlineNumberHTML(item.number) : "";
    // data-id 需要添加 item.id，否则大纲更新时 name 不一致导致 https://github.com/siyuan-note/siyuan/issues/11843
    return `<li class="b3-list-item${isMobile() ? "" : " b3-list-item--hide-action"}"
${item.id ? 'data-node-id="' + item.id + '"' : ""}
${item.box ? 'data-notebook-id="' + item.box + '"' : ""}
style="--file-toggle-width:${item.depth === 0 ? 22 : ((item.depth + 1) * 18)}px"
data-treetype="${item.type}"
data-type="${item.nodeType || ""}"
data-subtype="${item.subType || ""}"
${item.label !== undefined && item.label !== null ? `data-label='${item.label}'` : ""}>
    <span style="${getItemStyle(item.depth)}" class="b3-list-item__toggle${showArrow ? " b3-list-item__toggle--hl" : ""}${showArrow ? "" : " fn__hidden"}">
        <svg data-id="${item.id || encodeURIComponent(item.name + item.depth)}" class="b3-list-item__arrow${(item.type === "outline" ? !item.folded : hasChild) ? " b3-list-item__arrow--open" : ""}"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${iconHTML}
    ${numberHTML}
    <span class="b3-list-item__text ariaLabel" data-position="${options.titleTooltipPosition || "parentE"}"${titleTip}>${item.name}</span>
    ${options.topExtHTML || ""}
    ${countHTML}
</li>`;
};

/** 解析文档块图标；IAL 为空时要求应用存储已完成初始化。 */
const getDocumentBlockIcon = (item: TreeBlockData) => {
    // 块自身声明的图标拥有最高优先级，不依赖全局默认配置。
    if (item.ial?.icon) {
        return item.ial.icon;
    }
    // 文档块应携带可读取的 IAL；null 只对不读取 IAL 的普通块有效。
    if (!item.ial) {
        throw new Error("Tree document block IAL is missing");
    }
    const localImages = window.siyuan.storage?.[Constants.LOCAL_IMAGES];
    // 启动期存储尚未建立时应明确暴露初始化错误，避免输出损坏图标。
    if (!localImages) {
        throw new Error("Tree document icon storage is not initialized");
    }
    return localImages.file;
};

/** 生成块项图标；大纲、文档和普通块分别保留原有表现语义。 */
const renderBlockIcon = (item: TreeBlockData, type: string) => {
    if (type === "outline") {
        return `<svg data-showref="true" class="b3-list-item__graphic popover__block" data-id="${item.id}" style="height: 22px;width: 10px;"><use xlink:href="#${getIconByType(item.type, item.subType)}"></use></svg>`;
    }
    // 文档块优先使用自身 IAL 图标，缺省时读取统一文件图标配置。
    if (item.type === "NodeDocument") {
        const icon = getDocumentBlockIcon(item);
        return `<span data-showref="true" class="b3-list-item__graphic popover__block" data-id="${item.id}">${unicode2Emoji(icon)}</span>`;
    }
    return `<svg data-showref="true" class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type, item.subType)}"></use></svg>`;
};

/** 生成一个块项 LI，并保留拖拽、引用和扩展动作所需的数据属性。 */
const renderBlockItem = (item: TreeBlockData, type: string, options: TreeRenderOptions) => {
    const showBlockArrow = !!((item.children && item.children.length > 0) ||
        ((type === "backlink" || type === "bookmark") && !isMobile()));
    const countHTML = item.count ? `<span class="counter">${item.count}</span>` : "";
    const numberHTML = type === "outline" ? genOutlineNumberHTML(item.number) : "";
    return `<li class="b3-list-item${isMobile() ? "" : " b3-list-item--hide-action"}" ${options.blockDraggable ? 'draggable="true"' : ""}
style="--file-toggle-width:${item.depth === 0 ? 22 : ((item.depth + 1) * 18)}px"
data-node-id="${item.id}"
data-ref-text="${encodeURIComponent(item.refText)}"
data-def-id="${item.defID}"
data-type="${item.type || ""}"
data-subtype="${item.subType || ""}"
data-treetype="${type}"
data-def-path="${item.defPath}">
    <span style="${getItemStyle(item.depth)}" class="b3-list-item__toggle${showBlockArrow ? " b3-list-item__toggle--hl" : ""}${showBlockArrow ? "" : " fn__hidden"}">
        <svg data-id="${item.id}" class="b3-list-item__arrow${(type === "outline" ? !item.folded : !!item.children) ? " b3-list-item__arrow--open" : ""}"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${renderBlockIcon(item, type)}
    ${numberHTML}
    <span class="b3-list-item__text ariaLabel" data-position="${options.titleTooltipPosition || "parentE"}" ${type === "outline" ? ' aria-label="' + escapeAriaLabel(Lute.BlockDOM2Content(item.content)) + '"' : ""}>${item.content}</span>
    ${options.blockExtHTML || ""}
    ${countHTML}
</li>`;
};

/** 递归生成一组块列表；先固定数据、类型和配置，再由调用点传入当前层可见性。 */
const renderBlockHTML = (data: (IBlock | TreeBlockData)[], type: string, options: TreeRenderOptions) => (show: boolean) => {
    let html = `<ul class="${!show ? "fn__none" : ""}">`;
    for (const item of data) {
        // Tree 依赖内核 Block 的完整渲染字段，缺失时应确定性中止而非输出 undefined 属性。
        if (!isTreeBlockData(item)) {
            throw new Error("Tree block data is missing required render fields");
        }
        html += renderBlockItem(item, type, options);
        // 子块沿用大纲折叠状态，其他列表默认收起下一层。
        if (item.children && item.children.length > 0) {
            html += renderBlockHTML(item.children, type, options)(type === "outline" ? !item.folded : false) + "</ul>";
        }
    }
    return html;
};

/** 递归生成非空 Tree 数据的完整 HTML；由 Tree.updateData 在空状态判断后同步调用。 @同步豁免: UI构建 - innerHTML 写入和随后的公式渲染必须使用同一批同步生成结果。 */
export const renderTreeHTML = (data: TreeNodeData[], options: TreeRenderOptions) => {
    const firstItem = data[0];
    // Tree.updateData 已处理空数组；直接调用渲染器传入空数据属于明确的契约错误。
    if (!firstItem) {
        throw new Error("Tree renderer requires at least one item");
    }
    let html = `<ul${firstItem.depth === 0 ? " class='b3-list b3-list--background'" : ""}>`;
    for (const item of data) {
        html += renderTreeItem(item, options);
        // 分组子项直接递归 Tree 模板，保持同类项的属性和扩展区域。
        if (item.children && item.children.length > 0) {
            html += renderTreeHTML(item.children, options) + "</ul>";
        }
        // 块数据使用独立模板，并按大纲 folded 状态决定首层可见性。
        if (item.blocks && item.blocks.length > 0) {
            html += renderBlockHTML(item.blocks, item.type, options)(item.type === "outline" ? !item.folded : true) + "</ul>";
        }
    }
    return html;
};
