/** 用途：生成更新时间戳。使用范围：添加到数据库事务。解耦评估：时间格式约定继续复用基础库即可。 */
import { dayjs } from "./imports";
/** 用途：删除当前已选记录。使用范围：delete 菜单项。解耦评估：删除逻辑由 row 模块维护更一致。 */
import { deleteRow } from "./imports";
/** 用途：从主键单元格回读 block 值。使用范围：添加到数据库事务源构造。解耦评估：值解析由 cell 模块维护更可靠。 */
import { genCellValueByElement } from "./imports";
/** 用途：插入前后新记录。使用范围：单选场景下的 insert 菜单项。解耦评估：插入语义由 row 模块维护更一致。 */
import { insertRows } from "./imports";
/** 用途：校验数量输入框节点。使用范围：插入菜单 bind 阶段。解耦评估：输入框守卫继续复用共享工具即可。 */
import { isHTMLInputElement } from "./imports";
/** 用途：引用菜单实例类型。使用范围：修改型菜单构建阶段。解耦评估：菜单实例由入口创建，子模块只消费其接口。 */
import { Menu } from "./imports";
/** 用途：打开“添加到数据库”目标搜索面板。使用范围：addToDatabase 菜单项。解耦评估：目标选择 UI 已由 relation 模块维护。 */
import { openSearchAV } from "./imports";
/** 用途：读取修改型菜单文案。使用范围：add/delete/insert/unbind/fields。解耦评估：文案对象经共享网关转发即可。 */
import { siyuanI18n } from "./imports";
/** 用途：提交修改型事务。使用范围：添加到数据库。解耦评估：事务是 action 层主要副作用出口。 */
import { transaction } from "./imports";
/** 用途：回写单元格值。使用范围：unbindBlock 菜单项。解耦评估：单元格更新逻辑由 cell 模块维护更可靠。 */
import { updateCellsValue } from "./imports";
/** 用途：构建选择工具栏与右键菜单共用的批量字段编辑子菜单。使用范围：右键菜单 fields 子菜单及对应工具栏字段编辑。解耦评估：子菜单由领域工厂统一生成，上下文菜单仅消费其返回的 IMenu[]，不直接依赖内部实现，适合通过共享模块复用。 */
import { getAVEditFieldMenuItems } from "./imports";
/** 用途：读取右键菜单共享上下文类型。使用范围：修改型菜单动作构建阶段。解耦评估：类型集中在同层 types.ts，能避免业务文件各自定义局部类型。 */
import type { AttrViewContextmenuState } from "./types";
/** 用途：读取绑定插入菜单项所需的上下文类型。使用范围：插入前后菜单的 bind 阶段。解耦评估：类型集中在同层 types.ts，能避免业务文件各自定义局部类型。 */
import type { BindInsertMenuItemContext } from "./types";
/** 用途：读取插入菜单动作共享上下文类型。使用范围：插入前后菜单的动作执行阶段。解耦评估：类型集中在同层 types.ts，能避免业务文件各自定义局部类型。 */
import type { InsertMenuActionContext } from "./types";

/**
 * 作用：根据插入方向计算新行应挂载到哪个 previousID 之后。
 * 意图：插入前后菜单都复用同一套插入函数，只把“前一项是谁”的差异收敛到这里。
 * 调用时机：插入前后菜单点击或回车确认时调用。
 * 问题/改进：当前仍依赖 DOM 相邻节点关系，后续如列表支持虚拟滚动需要重新评估。
 */
const getInsertPreviousID = (rowElement: HTMLElement, insertAfter: boolean) => {
    if (insertAfter) {
        return rowElement.getAttribute("data-id") || undefined;
    }
    return rowElement.previousElementSibling?.getAttribute("data-id") || undefined;
};

/**
 * 作用：执行插入前后菜单的真实插入动作。
 * 意图：点击和回车都会落到同一条插入逻辑，避免两套分支渐渐漂移；通过上下文对象收敛 6 个同传参数，满足 max-params 约束。
 * 调用时机：插入菜单项上的 click / keydown 事件最终都会调用。
 * 问题/改进：当前仍直接读取 input 的字符串值并交给 parseInt，未附加额外的最小值纠正。
 */
const runInsertRowsFromMenu = (ctx: InsertMenuActionContext) => {
    insertRows({
        blockElement: ctx.blockElement,
        protyle: ctx.protyle,
        count: parseInt(ctx.inputElement.value, 10),
        previousID: getInsertPreviousID(ctx.rowElement, ctx.insertAfter) ?? "",
        groupID: ctx.rowElement.parentElement?.getAttribute("data-group-id") || "",
    });
    ctx.menu.close();
};

/**
 * 作用：处理插入菜单项容器上的点击确认。
 * 意图：保持鼠标点击菜单项任意区域即可按当前输入值插入的旧交互，同时避免输入框已聚焦时误触发；通过上下文对象收敛参数。
 * 调用时机：插入前后菜单项 bind 后添加的 click 事件触发时调用。
 * 问题/改进：当前仍依赖 `document.activeElement` 判断是否点击了输入框。
 */
const handleInsertMenuClick = (ctx: InsertMenuActionContext) => {
    if (document.activeElement === ctx.inputElement) {
        return;
    }
    runInsertRowsFromMenu(ctx);
};

/**
 * 作用：处理插入菜单项输入框上的回车确认。
 * 意图：保持原来“输入数量后回车直接插入”的快捷交互；上下文对象收敛 6 个同传参数，event 作为第二参数保持 ≤3。
 * 调用时机：插入前后菜单项 bind 后添加的 keydown 事件触发时调用。
 * 问题/改进：当前只处理 Enter，未额外拦截其它快捷键。
 */
const handleInsertMenuKeydown = (ctx: InsertMenuActionContext, event: KeyboardEvent) => {
    if (event.isComposing || event.key !== "Enter") {
        return;
    }
    runInsertRowsFromMenu(ctx);
};

/**
 * 作用：给插入前后菜单项挂接输入框交互。
 * 意图：把 bind 内部的 DOM 监听逻辑抽成命名函数，避免菜单项定义处继续堆叠匿名回调；通过上下文对象收敛 6 个同传参数，并用闭包绑定输入框。
 * 调用时机：插入前后菜单项被菜单组件 bind 到真实 DOM 节点时调用。
 * 问题/改进：当前仍由菜单项本地管理事件监听，后续如菜单组件支持 declarative form，可进一步收敛。
 */
const bindInsertMenuItem = (base: Omit<BindInsertMenuItemContext, "element">, element: HTMLElement) => {
    const inputCandidate = element.querySelector("input");
    if (!isHTMLInputElement(inputCandidate)) {
        return;
    }
    const actionCtx: InsertMenuActionContext = {
        menu: base.menu,
        protyle: base.protyle,
        blockElement: base.blockElement,
        rowElement: base.rowElement,
        insertAfter: base.insertAfter,
        inputElement: inputCandidate,
    };
    element.addEventListener("click", () => handleInsertMenuClick(actionCtx));
    inputCandidate.addEventListener("keydown", (event: KeyboardEvent) => handleInsertMenuKeydown(actionCtx, event));
};

/**
 * 作用：生成插入前后菜单项的展示文案。
 * 意图：保持 table 与卡片视图共用同一套数量输入模板，只在文案 key 上做差异化。
 * 调用时机：构建插入前后菜单项时调用。
 * 问题/改进：当前仍通过字符串模板直接拼接输入框 HTML。
 */
const buildInsertMenuLabel = (viewType: TAVView, insertAfter: boolean) => {
    const menuLabelKey = viewType === "table"
        ? insertAfter ? "insertRowAfter" : "insertRowBefore"
        : insertAfter ? "insertItemAfter" : "insertItemBefore";
    const menuLabel = siyuanI18n[menuLabelKey];
    return `<div class="fn__flex" style="align-items: center;">
${menuLabel.replace("${x}", `<span class="fn__space"></span><input style="width:64px" type="number" step="1" min="1" value="1" placeholder="${siyuanI18n.enterKey}" class="b3-text-field"><span class="fn__space"></span>`)}
</div>`;
};

/**
 * 作用：构建单选场景下的插入前后菜单项。
 * 意图：这些动作只对单条记录有意义，因此从可编辑菜单的公共部分中独立出来单独管理；通过上下文对象与 bind 部分应用避免多参。
 * 调用时机：`appendEditableContextmenuItems` 检测到单选后调用。
 * 问题/改进：当前插入数量输入仍固定为 64px 宽度，与旧实现一致。
 */
const appendSingleRowInsertItems = (menu: Menu, protyle: IProtyle, state: AttrViewContextmenuState) => {
    menu.addItem({
        id: state.viewType === "table" ? "insertRowBefore" : "insertItemBefore",
        icon: "iconBefore",
        label: buildInsertMenuLabel(state.viewType, false),
        bind: bindInsertMenuItem.bind(undefined, {
            menu,
            protyle,
            blockElement: state.blockElement,
            rowElement: state.keyRow.rowElement,
            insertAfter: false,
        }),
    });
    menu.addItem({
        id: state.viewType === "table" ? "insertRowAfter" : "insertItemAfter",
        icon: "iconAfter",
        label: buildInsertMenuLabel(state.viewType, true),
        bind: bindInsertMenuItem.bind(undefined, {
            menu,
            protyle,
            blockElement: state.blockElement,
            rowElement: state.keyRow.rowElement,
            insertAfter: true,
        }),
    });
};

/**
 * 作用：把当前多选记录转换为“添加到数据库”事务源数据。
 * 意图：集中维护主键 block 单元格到事务 srcs 的映射，避免菜单点击回调里直接拼装事务载荷。
 * 调用时机：添加到数据库目标视图选定后调用。
 * 问题/改进：当前仍假定每条记录都有 block 主键单元格。
 */
const buildAddToDatabaseSources = (state: AttrViewContextmenuState) => {
    const srcs: IOperationSrcs[] = [];
    const sourceIds: string[] = [];
    for (const selectedRow of state.selectedRows) {
        const blockValue = genCellValueByElement("block", selectedRow.keyCellElement);
        srcs.push({
            itemID: Lute.NewNodeID(),
            content: blockValue.block?.content || "",
            id: blockValue.block?.id || "",
            isDetached: blockValue.isDetached ?? false,
        });
        sourceIds.push(selectedRow.rowId);
    }
    return { srcs, sourceIds };
};

/**
 * 作用：在用户选定目标数据库后提交添加到数据库事务。
 * 意图：保持原有 openSearchAV 回调行为，并把事务组装集中到命名函数中便于审计。
 * 调用时机：addToDatabase 菜单项打开目标选择面板后，用户选定目标项时调用。
 * 问题/改进：当前仍依赖目标 list item 上的 dataset 协议。
 */
const handleAddToDatabaseTargetSelected = (
    protyle: IProtyle,
    state: AttrViewContextmenuState,
    listItemElement: HTMLElement,
) => {
    const avID = listItemElement.dataset.avId;
    const blockID = listItemElement.dataset.blockId;
    if (!avID || !blockID) {
        return;
    }
    const viewID = listItemElement.dataset.viewId;
    const { srcs, sourceIds } = buildAddToDatabaseSources(state);
    transaction(protyle, [{
        action: "insertAttrViewBlock",
        ignoreDefaultFill: !viewID,
        ...(viewID ? { viewID } : {}),
        avID,
        srcs,
        context: { ignoreTip: "true" },
        blockID,
        groupID: state.rowElement.parentElement?.getAttribute("data-group-id") || "",
    }, {
        action: "doUpdateUpdated",
        id: blockID,
        data: dayjs().format("YYYYMMDDHHmmss"),
    }], [{
        action: "removeAttrViewBlock",
        srcIDs: sourceIds,
        avID,
    }]);
};

/**
 * 作用：打开“添加到数据库”目标选择面板。
 * 意图：保持原有菜单行为，并把后续事务提交回调绑定到当前多选上下文。
 * 调用时机：addToDatabase 菜单项点击后调用。
 * 问题/改进：当前仍使用第一条已选记录作为目标面板的定位锚点。
 */
/**
 * 作用：打开“添加到数据库”目标选择面板。
 * 意图：保持原有菜单行为，并把后续事务提交回调绑定到当前多选上下文；通过对象参数适配严格类型。
 * 调用时机：addToDatabase 菜单项点击后调用。
 * 问题/改进：当前仍使用第一条已选记录作为目标面板的定位锚点。
 */
const handleAddToDatabaseClick = (protyle: IProtyle, state: AttrViewContextmenuState) => {
    const avID = state.blockElement.getAttribute("data-av-id");
    if (!avID) {
        return;
    }
    openSearchAV({
        avID,
        target: state.keyRow.rowElement,
        callback: handleAddToDatabaseTargetSelected.bind(undefined, protyle, state),
        purpose: "addToDatabase",
        blockID: state.blockElement.dataset.nodeId,
    });
};

/**
 * 作用：追加单选场景下的插入与解绑菜单项。
 * 意图：这些动作只对单条记录成立，单独拆出后可以保持主菜单构建顺序清晰。
 * 调用时机：可编辑菜单项构建过程中，在检测到单选后调用。
 * 问题/改进：当前仍沿用旧菜单的 separator id 约定。
 */
const appendSingleRowEditableItems = (menu: Menu, protyle: IProtyle, state: AttrViewContextmenuState) => {
    // 只有 attached 记录才需要在插入菜单前保留与旧实现一致的分隔线。
    if (!state.keyRow.isDetached) {
        menu.addSeparator({ id: "separator_1" });
    }
    appendSingleRowInsertItems(menu, protyle, state);
    menu.addSeparator({ id: "separator_2" });
    if (state.keyRow.isDetached) {
        return;
    }
    const keyText = state.keyRow.keyTextElement.textContent || "";
    const unbindValue = { content: keyText };
    menu.addItem({
        id: "unbindBlock",
        label: siyuanI18n.unbindBlock,
        icon: "iconLinkOff",
        /** 点击解绑块，清理关联并提交事务 */
        click: () => {
            updateCellsValue(protyle, state.blockElement, unbindValue, [state.keyRow.keyCellElement]);
        },
    });
};

/**
 * 作用：向主菜单追加所有“会修改数据”的右键菜单项。
 * 意图：把 addToDatabase、插入前后、解绑、删除和字段编辑从入口函数中整体下沉，降低主入口复杂度。
 * 调用时机：`avContextmenu` 在 copy 菜单之后、插件扩展之前调用。
 * 问题/改进：当前字段编辑菜单仍与插入/删除共处一个模块，若后续继续增长，可再拆成更细的子模块。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const appendEditableContextmenuItems = (menu: Menu, protyle: IProtyle, state: AttrViewContextmenuState) => {
    if (protyle.disabled) {
        return;
    }
    menu.addItem({
        id: "addToDatabase",
        label: siyuanI18n.addToDatabase,
        icon: "iconDatabase",
        /** 点击添加到数据库 */
        click: () => {
            handleAddToDatabaseClick(protyle, state);
        },
    });
    // 只有单选时，插入前后和解绑块这类动作才有明确的目标记录。
    if (state.selectedRows.length === 1) {
        appendSingleRowEditableItems(menu, protyle, state);
    }
    menu.addItem({
        id: "delete",
        icon: "iconTrashcan",
        label: siyuanI18n.delete,
        /** 点击删除行 */
        click: () => {
            deleteRow(state.blockElement, protyle);
        },
    });
    menu.addItem({
        id: "fields",
        icon: "iconAttr",
        label: siyuanI18n.fields,
        type: "submenu",
        submenu: getAVEditFieldMenuItems(protyle, state.blockElement),
    });
};
