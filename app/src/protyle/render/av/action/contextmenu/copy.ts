/** 用途：读取 HPath 接口。使用范围：copyHPath 菜单项。解耦评估：接口访问继续走共享网关即可。 */
import { fetchSyncPost } from "./imports";
/** 用途：读取复制菜单文案。使用范围：copy 子菜单项标题。解耦评估：文案对象经共享网关转发即可。 */
import { siyuanI18n } from "./imports";
/** 用途：写入系统剪贴板。使用范围：所有 copy 子菜单动作。解耦评估：剪贴板兼容逻辑不应在子模块重复实现。 */
import { writeText } from "./imports";
/** 用途：读取 AV view 属性并定位分组。使用范围：数据库条目协议链接。解耦评估：均由共享网关转发。 */
import {Constants, hasClosestByClassName} from "./imports";
/** 用途：读取右键菜单共享上下文类型。使用范围：copy 子菜单构建阶段。解耦评估：类型集中在同层 types.ts 能避免局部重复定义。 */
import type { AttrViewContextmenuState } from "./types";
/** 用途：读取已选记录结构类型。使用范围：copy 文本拼装阶段。解耦评估：类型集中在同层 types.ts 能避免局部重复定义。 */
import type { SelectedAttrViewRow } from "./types";

/**
 * 作用：把多选记录的复制结果组装成最终文本。
 * 意图：右键复制菜单的多个动作都共享“多选加列表前缀、单选直接输出”的格式规则，集中处理更不容易漂移。
 * 调用时机：各个同步复制动作在写入剪贴板前调用。
 * 问题/改进：当前只支持纯文本拼接，如果未来复制动作需要结构化输出，可以再扩展返回格式。
 */
const buildCopyText = (
    selectedRows: SelectedAttrViewRow[],
    resolveContent: (selectedRow: SelectedAttrViewRow) => string,
) => {
    const lines: string[] = [];
    const shouldUseListPrefix = selectedRows.length > 1;
    for (const selectedRow of selectedRows) {
        const content = resolveContent(selectedRow);
        lines.push(shouldUseListPrefix ? `- ${content}` : content);
    }
    return lines.join("\n");
};

/**
 * 作用：按顺序异步组装多选记录的复制结果。
 * 意图：复制 HPath 需要逐条等待接口结果，同时仍保持原有的多选输出顺序。
 * 调用时机：复制 HPath 菜单项点击后调用。
 * 问题/改进：当前仍是逐条串行请求，后续如果需要性能优化，可评估是否允许并发请求后再按顺序合并。
 */
const buildCopyTextAsync = async (
    selectedRows: SelectedAttrViewRow[],
    resolveContent: (selectedRow: SelectedAttrViewRow) => Promise<string>,
) => {
    const lines: string[] = [];
    const shouldUseListPrefix = selectedRows.length > 1;
    for (const selectedRow of selectedRows) {
        const content = await resolveContent(selectedRow);
        lines.push(shouldUseListPrefix ? `- ${content}` : content);
    }
    return lines.join("\n");
};

/**
 * 作用：把主键文本中的换行压平成单行。
 * 意图：块引用和协议 markdown 都要求展示文本为单行，沿用原始菜单实现里的 replace 规则。
 * 调用时机：复制 block ref / protocol in md 时调用。
 * 问题/改进：当前仅替换换行，不处理更复杂的空白规范化。
 */
const normalizeBlockText = (selectedRow: SelectedAttrViewRow) => {
    const textContent = selectedRow.keyTextElement.textContent || "";
    return textContent.replace(/[\n]+/g, " ");
};

/**
 * 作用：读取 detached 记录在复制场景下的降级文本。
 * 意图：detached block 没有可稳定引用的块地址时，应继续输出原始主键文本而不是伪造引用。
 * 调用时机：所有 block 相关复制动作在检测到 detached 后调用。
 * 问题/改进：当前直接读取 textContent，未区分富文本与纯文本展示差异。
 */
const getDetachedText = (selectedRow: SelectedAttrViewRow) => {
    return selectedRow.keyTextElement.textContent || "";
};

/**
 * 作用：解析单条记录复制 HPath 时的输出内容。
 * 意图：把 HPath 接口访问和 detached 降级逻辑抽出来，避免异步复制流程里留下过长内联回调。
 * 调用时机：copyHPath 菜单项点击后，按顺序遍历每条已选记录时调用。
 * 问题/改进：当前仍逐条请求接口，数量很多时会有明显等待时间。
 */
const resolveHPathCopyContent = async (selectedRow: SelectedAttrViewRow) => {
    if (selectedRow.isDetached) {
        return getDetachedText(selectedRow);
    }
    const response = await fetchSyncPost("/api/filetree/getHPathByID", { id: selectedRow.blockId });
    return response.data;
};

/**
 * 作用：复制主键文本内容。
 * 意图：保持“复制主键内容”菜单项始终可用，并对多选结果沿用原有列表格式。
 * 调用时机：copyKeyContent 菜单项点击后调用。
 * 问题/改进：当前仍直接取 textContent.trim()，不会保留前后空白。
 */
const handleCopyKeyContent = (selectedRows: SelectedAttrViewRow[]) => {
    const text = buildCopyText(selectedRows, (selectedRow) => {
        return selectedRow.keyTextElement.textContent?.trim() || "";
    });
    writeText(text);
};

/**
 * 作用：复制块引用文本。
 * 意图：attached 记录输出 `((id 'content'))`，detached 记录退回原文，保持原菜单行为。
 * 调用时机：copyBlockRef 菜单项点击后调用。
 * 问题/改进：当前展示文本仍采用单引号包裹，若主键文本包含引号，后续可考虑统一转义策略。
 */
const handleCopyBlockRef = (selectedRows: SelectedAttrViewRow[]) => {
    const text = buildCopyText(selectedRows, (selectedRow) => {
        if (selectedRow.isDetached) {
            return getDetachedText(selectedRow);
        }
        return `((${selectedRow.blockId} '${normalizeBlockText(selectedRow)}'))`;
    });
    writeText(text);
};

/**
 * 作用：复制块嵌入 SQL 片段。
 * 意图：attached 记录输出查询语句，detached 记录继续输出原文，保持原菜单行为。
 * 调用时机：copyBlockEmbed 菜单项点击后调用。
 * 问题/改进：当前 SQL 模板固定为 blocks 表主键查询，如未来支持别名或多表视图，需要同步扩展。
 */
const handleCopyBlockEmbed = (selectedRows: SelectedAttrViewRow[]) => {
    const text = buildCopyText(selectedRows, (selectedRow) => {
        if (selectedRow.isDetached) {
            return getDetachedText(selectedRow);
        }
        return `{{select * from blocks where id='${selectedRow.blockId}'}}`;
    });
    writeText(text);
};

/**
 * 作用：复制 siyuan 协议链接。
 * 意图：attached 记录输出 `siyuan://blocks/id`，detached 记录继续输出原文，保持原菜单行为。
 * 调用时机：copyProtocol 菜单项点击后调用。
 * 问题/改进：当前只复制块协议，不包含工作空间等其它上下文。
 */
const handleCopyProtocol = (selectedRows: SelectedAttrViewRow[]) => {
    const text = buildCopyText(selectedRows, (selectedRow) => {
        if (selectedRow.isDetached) {
            return getDetachedText(selectedRow);
        }
        return `siyuan://blocks/${selectedRow.blockId}`;
    });
    writeText(text);
};

/**
 * 作用：复制 markdown 协议链接。
 * 意图：attached 记录输出 `[text](siyuan://blocks/id)`，detached 记录继续输出原文，保持原菜单行为。
 * 调用时机：copyProtocolInMd 菜单项点击后调用。
 * 问题/改进：当前只做换行压平，不会额外转义 markdown 特殊字符。
 */
const handleCopyProtocolInMarkdown = (selectedRows: SelectedAttrViewRow[]) => {
    const text = buildCopyText(selectedRows, (selectedRow) => {
        if (selectedRow.isDetached) {
            return getDetachedText(selectedRow);
        }
        return `[${normalizeBlockText(selectedRow)}](siyuan://blocks/${selectedRow.blockId})`;
    });
    writeText(text);
};

/**
 * 作用：复制块层级路径。
 * 意图：attached 记录需要通过接口读取 HPath，detached 记录继续输出原文，保持原菜单行为。
 * 调用时机：copyHPath 菜单项点击后调用。
 * 问题/改进：当前逐条请求接口，数量很多时会有明显等待时间。
 */
const handleCopyHPath = async (selectedRows: SelectedAttrViewRow[]) => {
    const text = await buildCopyTextAsync(selectedRows, resolveHPathCopyContent);
    writeText(text);
};

/**
 * 作用：复制块 ID。
 * 意图：attached 记录输出真实 block id，detached 记录继续输出原文，保持原菜单行为。
 * 调用时机：copyID 菜单项点击后调用。
 * 问题/改进：当前只复制主键块 ID，不包含当前行 ID。
 */
const handleCopyID = (selectedRows: SelectedAttrViewRow[]) => {
    const text = buildCopyText(selectedRows, (selectedRow) => {
        if (selectedRow.isDetached) {
            return getDetachedText(selectedRow);
        }
        return selectedRow.blockId;
    });
    writeText(text);
};

/**
 * 作用：构建属性视图右键菜单中的复制子菜单。
 * 意图：把始终可用的主键复制项和仅对 attached 记录开放的块复制项拆开管理，便于后续扩展。
 * 调用时机：`avContextmenu` 创建主菜单后立即调用。
 * 问题/改进：当前菜单项顺序仍遵循旧实现，若后续产品调整文案或排序，应在这里集中变更。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const buildCopyMenu = (state: AttrViewContextmenuState) => {
    const copyMenu: IMenu[] = [{
        id: "copyKeyContent",
        iconHTML: "",
        label: siyuanI18n.copyKeyContent,
        click: handleCopyKeyContent.bind(undefined, state.selectedRows),
    }, {
        id: "copyDatabaseItemLink",
        iconHTML: "",
        label: siyuanI18n.copyDatabaseItemLink,
        click: () => {
            const viewID = state.blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) ||
                state.blockElement.querySelector(".layout-tab-bar .item--focus")?.getAttribute("data-id") || "";
            const links = state.selectedRows.map((selectedRow) => {
                const params = new URLSearchParams({
                    avViewID: viewID,
                    avItemID: selectedRow.rowId,
                });
                const groupID = (hasClosestByClassName(selectedRow.rowElement, "av__body") as HTMLElement)?.dataset.groupId;
                if (groupID) {
                    params.set("avGroupID", groupID);
                }
                return `siyuan://blocks/${state.blockElement.dataset.nodeId}?${params.toString()}`;
            });
            writeText(links.join("\n"));
        },
    }];
    if (!state.hasAttachedBlock) {
        return copyMenu;
    }
    copyMenu.push({
        id: "copyBlockRef",
        iconHTML: "",
        label: siyuanI18n.copyBlockRef,
        click: handleCopyBlockRef.bind(undefined, state.selectedRows),
    });
    copyMenu.push({
        id: "copyBlockEmbed",
        iconHTML: "",
        label: siyuanI18n.copyBlockEmbed,
        click: handleCopyBlockEmbed.bind(undefined, state.selectedRows),
    });
    copyMenu.push({
        id: "copyProtocol",
        iconHTML: "",
        label: siyuanI18n.copyProtocol,
        click: handleCopyProtocol.bind(undefined, state.selectedRows),
    });
    copyMenu.push({
        id: "copyProtocolInMd",
        iconHTML: "",
        label: siyuanI18n.copyProtocolInMd,
        click: handleCopyProtocolInMarkdown.bind(undefined, state.selectedRows),
    });
    copyMenu.push({
        id: "copyHPath",
        iconHTML: "",
        label: siyuanI18n.copyHPath,
        click: handleCopyHPath.bind(undefined, state.selectedRows),
    });
    copyMenu.push({
        id: "copyID",
        iconHTML: "",
        label: siyuanI18n.copyID,
        click: handleCopyID.bind(undefined, state.selectedRows),
    });
    return copyMenu;
};
