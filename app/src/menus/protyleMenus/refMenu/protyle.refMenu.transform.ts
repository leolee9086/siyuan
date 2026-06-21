/** 用途：读取国际化文案；使用范围：turnInto 子菜单 label；解耦评估：i18n 来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：更新时间字符串；使用范围：引用转换后写入 updated；解耦评估：第三方依赖通过 imports.ts 转发。 */
import { dayjs } from "./imports";
/** 用途：提交事务；使用范围：转换动作后的持久化更新；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：读取引用文本；使用范围：turnToDynamic 回填文本；解耦评估：请求能力统一入口。 */
import { fetchPost } from "./imports";
/** 用途：移除行内标记；使用范围：turnInto->text 动作；解耦评估：标记处理在工具层封装。 */
import { removeInlineType } from "./imports";
/** 用途：聚焦指定 Range；使用范围：转换后恢复输入位置；解耦评估：选区能力封装在工具层。 */
import { focusByRange } from "./imports";
/** 用途：通过 wbr 恢复光标；使用范围：turnInto->link 后恢复焦点；解耦评估：选区能力封装在工具层。 */
import { focusByWbr } from "./imports";
/** 用途：执行块渲染；使用范围：turnInto->blockEmbed 后重渲染；解耦评估：渲染入口统一。 */
import { blockRender } from "./imports";

/**
 * 作用：安全读取编辑器工具栏选区对象。
 * 意图：统一处理 toolbar 可能为空的情况，避免在各转换动作里重复空值判断。
 * 调用时机：所有需要访问 `toolbar.range` 的转换动作执行前。
 * 问题/改进：当 toolbar 不可用时仅返回 undefined，调用方需自行决定降级策略。
 */
const 获取工具栏Range = (protyle: IProtyle) => {
    return protyle.toolbar?.range;
};

/**
 * 作用：在工具栏选区存在时恢复焦点。
 * 意图：把“判空 + focusByRange”封装为单点逻辑，减少重复分支并保持转换后行为一致。
 * 调用时机：引用转换完成后需要回到编辑位置时。
 * 问题/改进：toolbar 缺失时会静默跳过聚焦，后续可评估是否需要显式 fallback。
 */
const 聚焦工具栏Range = (protyle: IProtyle) => {
    const toolbarRange = 获取工具栏Range(protyle);
    if (toolbarRange) {
        focusByRange(toolbarRange);
    }
};

/**
 * 作用：提交引用节点修改事务并刷新旧 HTML 快照。
 * 意图：统一所有转换动作的“写 updated + 提交事务 + 更新快照”步骤，避免重复实现。
 * 调用时机：各 turnInto 动作完成 DOM 更新后。
 * 问题/改进：目前始终提交事务，后续可评估是否加入“内容未变化跳过提交”优化。
 */
const 提交引用事务 = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string }
) => {
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeElement, htmlState.oldHTML);
    htmlState.oldHTML = nodeElement.outerHTML;
};

/**
 * 作用：处理“转动态引用”后的异步回填响应。
 * 意图：把异步响应处理从发起逻辑中拆开，避免创建大型内联回调。
 * 调用时机：`/api/block/getRefText` 请求返回时。
 * 问题/改进：当前未处理接口异常分支，后续可补充失败提示与回滚策略。
 */
const 处理动态引用回填响应 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement,
    response: IWebSocketData
) => {
    refElement.innerHTML = response.data;
    提交引用事务(protyle, nodeElement, htmlState);
    聚焦工具栏Range(protyle);
};

/**
 * 作用：把当前引用切换为动态引用并回填展示文本。
 * 意图：将 subtype 变更、接口请求、回填处理封装在同一动作里，保持菜单 click 绑定简洁。
 * 调用时机：turnInto -> `turnToDynamic` 点击后。
 * 问题/改进：异步回填期间无加载状态，后续可按体验需求补充。
 */
const 执行转动态引用 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement,
    refBlockId: string
) => {
    refElement.setAttribute("data-subtype", "d");
    fetchPost(
        "/api/block/getRefText",
        { id: refBlockId },
        处理动态引用回填响应.bind(null, protyle, id, nodeElement, htmlState, refElement)
    );
};

/**
 * 作用：把当前引用切换为静态引用。
 * 意图：保持与动态引用互转的行为一致，并复用统一事务提交流程。
 * 调用时机：turnInto -> `turnToStatic` 点击后。
 * 问题/改进：后续可考虑在 UI 上增加静态/动态状态提示。
 */
const 执行转静态引用 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.setAttribute("data-subtype", "s");
    提交引用事务(protyle, nodeElement, htmlState);
    聚焦工具栏Range(protyle);
};

/**
 * 作用：把块引用转为纯文本。
 * 意图：复用 inline 标记移除工具，确保转换后的选区状态与编辑器规范一致。
 * 调用时机：turnInto -> `text` 点击后。
 * 问题/改进：若未来支持更多 inline 语法，可能需要扩展移除策略。
 */
const 执行转文本 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    removeInlineType(refElement, "block-ref", 获取工具栏Range(protyle));
    提交引用事务(protyle, nodeElement, htmlState);
};

/**
 * 作用：把引用文本转换为 `*` 占位样式。
 * 意图：提供与历史菜单一致的简写展示形式，并保持事务/焦点处理一致。
 * 调用时机：turnInto -> `*` 点击后。
 * 问题/改进：`*` 语义较隐式，后续可评估是否提供更明确文案提示。
 */
const 执行转星号 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.setAttribute("data-subtype", "s");
    refElement.textContent = "*";
    提交引用事务(protyle, nodeElement, htmlState);
    聚焦工具栏Range(protyle);
};

/**
 * 作用：把引用转换为“文本 + 星号”组合形式。
 * 意图：保留原文本内容的同时将引用节点本体替换为 `*`，兼顾可读性与结构需求。
 * 调用时机：turnInto -> `text*` 点击后。
 * 问题/改进：文本插入方式基于 `innerHTML`，后续可评估更严格的节点级拼接。
 */
const 执行转文本星号 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.insertAdjacentHTML("beforebegin", refElement.innerHTML + " ");
    refElement.setAttribute("data-subtype", "s");
    refElement.textContent = "*";
    提交引用事务(protyle, nodeElement, htmlState);
    聚焦工具栏Range(protyle);
};

/**
 * 作用：把块引用转换为普通链接节点。
 * 意图：复用 `siyuan://blocks/{id}` 协议实现“保持跳转能力但脱离 block-ref 结构”。
 * 调用时机：turnInto -> `link` 点击后。
 * 问题/改进：当前直接拼接 HTML，后续可评估改为 DOM API 组装以降低字符串模板风险。
 */
const 执行转链接 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.outerHTML = `<span data-type="a" data-href="siyuan://blocks/${refElement.getAttribute("data-id")}">${refElement.innerHTML}</span><wbr>`;
    提交引用事务(protyle, nodeElement, htmlState);
    const toolbarRange = 获取工具栏Range(protyle);
    if (toolbarRange) {
        focusByWbr(nodeElement, toolbarRange);
    }
};

/**
 * 作用：把整段引用转换为块嵌入节点并触发重渲染。
 * 意图：在满足结构约束时提供“引用 -> 嵌入”的一步转换能力。
 * 调用时机：turnInto -> `blockEmbed` 点击后。
 * 问题/改进：当前对父容器结构要求严格，后续可评估更宽松的判定策略。
 */
const 执行转块嵌入 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refBlockId: string
) => {
    const attrElement = nodeElement.querySelector(".protyle-attr");
    if (!attrElement) {
        return;
    }
    nodeElement.insertAdjacentHTML("afterend", `<div data-content="select * from blocks where id='${refBlockId}'" data-node-id="${id}" data-type="NodeBlockQueryEmbed" class="render-node" updated="${dayjs().format("YYYYMMDDHHmmss")}">${attrElement.outerHTML}</div>`);
    const embedElement = nodeElement.nextElementSibling as HTMLElement;
    nodeElement.remove();
    updateTransaction(protyle, embedElement, htmlState.oldHTML);
    blockRender(protyle, protyle.wysiwyg.element);
    htmlState.oldHTML = embedElement.outerHTML;
};

/**
 * 作用：追加 text、星号、text+星号、link 这组基础转换菜单项。
 * 意图：把基础动作集中维护，避免主函数出现重复 push 模板。
 * 调用时机：创建 turnInto 子菜单的中段。
 * 问题/改进：目前顺序固定，后续如需定制化可引入配置驱动。
 */
const 追加基础转换菜单项 = (
    submenu: IMenu[],
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    submenu.push({
        id: "text",
        iconHTML: "",
        label: siyuanI18n.text,
        click: 执行转文本.bind(null, protyle, id, nodeElement, htmlState, refElement)
    });
    submenu.push({
        id: "*",
        iconHTML: "",
        label: "*",
        click: 执行转星号.bind(null, protyle, id, nodeElement, htmlState, refElement)
    });
    submenu.push({
        id: "text*",
        iconHTML: "",
        label: siyuanI18n.text + " *",
        click: 执行转文本星号.bind(null, protyle, id, nodeElement, htmlState, refElement)
    });
    submenu.push({
        id: "link",
        iconHTML: "",
        label: siyuanI18n.link,
        click: 执行转链接.bind(null, protyle, id, nodeElement, htmlState, refElement)
    });
};

/**
 * 作用：追加 defBlock 与 defBlockChildren 两个“定义块交换”菜单项。
 * 意图：将交换接口调用参数固定在菜单层，避免主流程直接拼装请求体。
 * 调用时机：创建 turnInto 子菜单末段。
 * 问题/改进：当前不处理请求返回，后续可按需要补充错误反馈。
 */
const 追加定义块交换菜单项 = (submenu: IMenu[], id: string | null, refBlockId: string) => {
    submenu.push({
        id: "defBlock",
        iconHTML: "",
        label: siyuanI18n.defBlock,
        click: fetchPost.bind(null, "/api/block/swapBlockRef", {
            refID: id,
            defID: refBlockId,
            includeChildren: false
        })
    });
    submenu.push({
        id: "defBlockChildren",
        iconHTML: "",
        label: siyuanI18n.defBlockChildren,
        click: fetchPost.bind(null, "/api/block/swapBlockRef", {
            refID: id,
            defID: refBlockId,
            includeChildren: true
        })
    });
};

/**
 * 作用：创建 turnInto 子菜单。
 * 意图：把转换动作集合从主流程拆分为独立关注点模块。
 * 调用时机：refMenu 可编辑分支构建菜单时。
 * 问题/改进：菜单项顺序仍硬编码，后续可改配置驱动。
 */
/** @同步豁免: UI构建 */
export const 创建转换子菜单 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement,
    refBlockId: string
) => {
    const submenu: IMenu[] = [];
    // 静态引用可转换为动态引用。
    if (refElement.getAttribute("data-subtype") === "s") {
        submenu.push({
            id: "turnToDynamic",
            iconHTML: "",
            label: siyuanI18n.turnToDynamic,
            click: 执行转动态引用.bind(null, protyle, id, nodeElement, htmlState, refElement, refBlockId)
        });
    }
    // 动态引用可转换为静态引用。
    if (refElement.getAttribute("data-subtype") !== "s") {
        submenu.push({
            id: "turnToStatic",
            iconHTML: "",
            label: siyuanI18n.turnToStatic,
            click: 执行转静态引用.bind(null, protyle, id, nodeElement, htmlState, refElement)
        });
    }
    追加基础转换菜单项(submenu, protyle, id, nodeElement, htmlState, refElement);

    const parentElement = refElement.parentElement;
    // 引用独占一个 DIV 且文本一致时，允许转换为块嵌入。
    if (parentElement && parentElement.tagName === "DIV" && parentElement.textContent.trim() === refElement.textContent.trim()) {
        submenu.push({
            id: "blockEmbed",
            iconHTML: "",
            label: siyuanI18n.blockEmbed,
            click: 执行转块嵌入.bind(null, protyle, id, nodeElement, htmlState, refBlockId)
        });
    }
    追加定义块交换菜单项(submenu, id, refBlockId);
    return submenu;
};
