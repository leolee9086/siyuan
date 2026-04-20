/**
 * listRouter Transform 执行器
 *
 * 本文件包含列表转换操作的执行器函数
 * 由于 transform 执行器较为复杂，单独拆分为独立模块
 */

/**
 * 用途：通过同层依赖网关引入段落/批量块转引用事务函数，供当前转换执行器在“转换为引用”命令中复用既有事务提交逻辑。
 * 使用范围：仅用于 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:316) 在段落、标题、列表转换为引用块的执行分支中提交 [`Blocks2Blockquote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:336) 事务；边界是不参与无序列表、有序列表、任务列表转换，也不负责事务参数组装之外的路由判断。
 * 解耦评估：理论上可把 [`turnsIntoOneTransaction`](app/src/protyle/wysiwyg/keydown.list/imports.ts:81) 作为参数注入 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:321)，但当前 transform 执行器是静态导出的命令映射，若改为注入会把依赖继续扩散到 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts:266) 的执行器映射与调用链；事件发射也不适合这种需要 `await` 获取完成时机的事务调用。当前经由 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 单点转发事务依赖，已经比直接使用父级 `../transaction` 路径更低耦合。
 */
import { turnsIntoOneTransaction } from "./imports";
/**
 * 用途：引入列表命令常量，确保当前转换执行器记录日志、选择执行目标与直接导出处理器时都复用统一命令契约。
 * 使用范围：仅用于 [`executeTransformToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:99)、[`executeTransformToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:183)、[`executeTransformToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:267) 与 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:356)；边界是不在本文件内定义新命令，也不承担路由决策逻辑。
 * 解耦评估：命令常量属于执行层与路由层共享的稳定契约。理论上可把命令值从调用方参数传入，但那会把同一命令空间透传到每个执行器，增加签名噪音且不减少真实耦合；若改成事件名字符串会导致契约分散。继续直接依赖同目录 [`commands.ts`](app/src/protyle/wysiwyg/keydown.list/commands.ts) 是当前最小且准确的耦合面。
 */
import { LIST_COMMANDS } from "./commands";
/**
 * 用途：引入转换执行器统一函数签名类型，保证当前四个执行器实现与命令调度层约定的参数/返回契约一致。
 * 使用范围：仅用于 [`executeTransformToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:70)、[`executeTransformToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:154)、[`executeTransformToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:238) 与 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:275) 的 TypeScript 类型标注；边界是只参与编译期校验，不引入运行时逻辑。
 * 解耦评估：[`CommandExecutor`](app/src/protyle/wysiwyg/keydown.list/types.ts:238) 是编译期契约，无法通过事件发射替代。理论上可以在本文件重复声明函数签名或以内联类型标注代替，但会复制与 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 中共享的执行器协议，后续调度参数变化时容易失配。保持从单一类型源导入是更低耦合的真实方案。
 */
import type { CommandExecutor } from "./types";
/**
 * 用途：通过同层日志网关引入统一命令执行日志函数，供当前转换执行器在引用转换或 hint 回退分支中记录一致格式的诊断信息。
 * 使用范围：仅用于 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:347) 与 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:365) 的日志记录；边界是不负责日志级别配置，也不参与列表类型互转辅助流程日志，那部分由 helper 自身处理。
 * 解耦评估：理论上可把日志函数作为参数传入当前执行器，但 transform 执行器映射是静态常量，若逐层注入只会把日志依赖扩散到命令调度层与测试装配层；事件发射也无法自然承载这里需要同步携带 `command`、`nodeElement` 与上下文对象的结构化日志。继续经由同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts:73) 引入，是当前架构下更低耦合的方案。
 */
import { logCommandExecution } from "./imports";
/**
 * 用途：引入多选/当前块选择提取函数，供各转换执行器统一获取本次命令作用的块元素集合。
 * 使用范围：仅用于 [`executeTransformToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:73)、[`executeTransformToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:157)、[`executeTransformToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:241) 与 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:278)；边界是不负责元素类型解析或事务提交。
 * 解耦评估：理论上可由上层先计算 `selectsElement` 后作为参数传入每个执行器，但当前执行器签名由统一命令调度层固定，新增参数会把选择逻辑扩散到更多入口；事件发射更不适合这种同步读取编辑器状态的场景。保留对 helper 的直接静态依赖更符合当前模块边界。
 */
import { getSelectElements } from "./executors.transform.helpers";
/**
 * 用途：引入块元素元信息提取函数，供转换执行器根据当前目标块判断段落/列表/标题及列表子类型。
 * 使用范围：仅用于 [`executeTransformToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:81)、[`executeTransformToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:165)、[`executeTransformToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:249) 与 [`executeTransformToQuote`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:285)；边界是不负责 DOM 选择集收集与后续事务执行。
 * 解耦评估：可把 `type/subType/nodeId` 从外部预处理后传入执行器，但那会让调度层承担本应属于转换执行层的语义解析职责，并把同一解析逻辑扩散到更多调用点。当前直接依赖同层 helper 保持了解析职责内聚，是更低耦合的方案。
 */
import { extractElementInfo } from "./executors.transform.helpers";
/**
 * 用途：引入段落转列表辅助函数，供单选段落场景复用既有段落转无序/有序/任务列表的事务与日志流程。
 * 使用范围：仅用于 [`handleSingleSelectToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:35)、[`handleSingleSelectToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:119) 与 [`handleSingleSelectToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:203)；边界是不处理列表互转与引用转换。
 * 解耦评估：理论上可把段落转换逻辑直接内联到三个处理函数中，或由外部参数注入转换器，但这样会重新引入重复事务组装与日志代码。当前通过同层 helper 集中复用，反而减少业务耦合与重复实现，符合 DRY。
 */
import { transformParagraphToList } from "./executors.transform.helpers";
/**
 * 用途：引入列表类型互转辅助函数，供单选列表场景执行无序、有序、任务列表之间的单节点转换。
 * 使用范围：仅用于 [`handleSingleSelectToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:49)、[`handleSingleSelectToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:133) 与 [`handleSingleSelectToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:217)；边界是不负责段落转列表、多选批量转换或引用 hint 回退。
 * 解耦评估：理论上可由每个处理函数自行直接调用事务层 API，但那会把互转细节、日志和结果描述重复铺开到多个分支；若改为参数注入，调用方仍需理解同一互转协议，收益有限。当前保留同层 helper 静态依赖，是较低耦合且更易维护的方案。
 */
import { transformListType } from "./executors.transform.helpers";
/**
 * 用途：引入批量转换辅助函数，供多选场景统一复用批量转无序/有序/任务列表的事务与日志流程。
 * 使用范围：仅用于 [`executeTransformToUL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:93)、[`executeTransformToOL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:177) 与 [`executeTransformToTL`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:261)；边界是不处理单节点列表互转和引用转换。
 * 解耦评估：理论上可把批量转换逻辑内联到三个执行器中，但会复制事务调用、结果描述和日志模式；也可把它作为参数注入，但当前只有本文件消费该能力，参数化只会增加样板。维持对 helper 的直接依赖更低耦合。
 */
import { transformBatch } from "./executors.transform.helpers";

/**
 * 处理单选场景的无序列表转换
 */
export const handleSingleSelectToUL = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetElement: HTMLElement,
    type: string | null,
    subType: string | null,
    nodeId: string | null,
    event: KeyboardEvent,
    nodeElement: HTMLElement
) => {
    // 段落转换为无序列表
    if (type === "NodeParagraph") {
        await transformParagraphToList(
            protyle, selectsElement, "Blocks2ULs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL, nodeId, type
        );
        return;
    }
    
    // 列表类型转换：需要 nodeId 存在
    if (type !== "NodeList" || !nodeId) {
        return;
    }
    
    // 有序列表 -> 无序列表
    if (subType === "o") {
        await transformListType(
            protyle, targetElement, nodeId, "OL2UL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL, subType,
            "有序列表转换为无序列表"
        );
        return;
    }
    
    // 任务列表 -> 无序列表
    if (subType === "t") {
        await transformListType(
            protyle, targetElement, nodeId, "TL2UL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL, subType,
            "任务列表转换为无序列表"
        );
    }
};

/**
 * 执行转换为无序列表命令（Phase 4）
 */
export const executeTransformToUL: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const isSingleSelect = selectsElement.length === 1;
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type, subType, nodeId } = extractElementInfo(targetElement);
    
    // 单选场景
    if (isSingleSelect) {
        await handleSingleSelectToUL(
            protyle, selectsElement, targetElement,
            type, subType, nodeId, event, nodeElement
        );
    }
    
    // 多选场景：批量转换为无序列表
    if (!isSingleSelect) {
        await transformBatch(
            protyle, selectsElement, "Blocks2ULs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL
        );
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表转换为无序列表操作");
};

/**
 * 处理单选场景的有序列表转换
 */
export const handleSingleSelectToOL = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetElement: HTMLElement,
    type: string | null,
    subType: string | null,
    nodeId: string | null,
    event: KeyboardEvent,
    nodeElement: HTMLElement
) => {
    // 段落转换为有序列表
    if (type === "NodeParagraph") {
        await transformParagraphToList(
            protyle, selectsElement, "Blocks2OLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL, nodeId, type
        );
        return;
    }
    
    // 列表类型转换：需要 nodeId 存在
    if (type !== "NodeList" || !nodeId) {
        return;
    }
    
    // 无序列表 -> 有序列表
    if (subType === "u") {
        await transformListType(
            protyle, targetElement, nodeId, "UL2OL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL, subType,
            "无序列表转换为有序列表"
        );
        return;
    }
    
    // 任务列表 -> 有序列表
    if (subType === "t") {
        await transformListType(
            protyle, targetElement, nodeId, "TL2OL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL, subType,
            "任务列表转换为有序列表"
        );
    }
};

/**
 * 执行转换为有序列表命令（Phase 4）
 */
export const executeTransformToOL: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const isSingleSelect = selectsElement.length === 1;
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type, subType, nodeId } = extractElementInfo(targetElement);
    
    // 单选场景
    if (isSingleSelect) {
        await handleSingleSelectToOL(
            protyle, selectsElement, targetElement,
            type, subType, nodeId, event, nodeElement
        );
    }
    
    // 多选场景：批量转换为有序列表
    if (!isSingleSelect) {
        await transformBatch(
            protyle, selectsElement, "Blocks2OLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL
        );
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表转换为有序列表操作");
};

/**
 * 处理单选场景的任务列表转换
 */
export const handleSingleSelectToTL = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetElement: HTMLElement,
    type: string | null,
    subType: string | null,
    nodeId: string | null,
    event: KeyboardEvent,
    nodeElement: HTMLElement
) => {
    // 段落转换为任务列表
    if (type === "NodeParagraph") {
        await transformParagraphToList(
            protyle, selectsElement, "Blocks2TLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL, nodeId, type
        );
        return;
    }
    
    // 列表类型转换：需要 nodeId 存在
    if (type !== "NodeList" || !nodeId) {
        return;
    }
    
    // 无序列表 -> 任务列表
    if (subType === "u") {
        await transformListType(
            protyle, targetElement, nodeId, "UL2TL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL, subType,
            "无序列表转换为任务列表"
        );
        return;
    }
    
    // 有序列表 -> 任务列表
    if (subType === "o") {
        await transformListType(
            protyle, targetElement, nodeId, "OL2TL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL, subType,
            "有序列表转换为任务列表"
        );
    }
};

/**
 * 执行转换为任务列表命令（Phase 4）
 */
export const executeTransformToTL: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const isSingleSelect = selectsElement.length === 1;
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type, subType, nodeId } = extractElementInfo(targetElement);
    
    // 单选场景
    if (isSingleSelect) {
        await handleSingleSelectToTL(
            protyle, selectsElement, targetElement,
            type, subType, nodeId, event, nodeElement
        );
    }
    
    // 多选场景：批量转换为任务列表
    if (!isSingleSelect) {
        await transformBatch(
            protyle, selectsElement, "Blocks2TLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL
        );
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表转换为任务列表操作");
};

/**
 * 执行转换为引用命令（Phase 4）
 */
export const executeTransformToQuote: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type } = extractElementInfo(targetElement);
    
    // 只有段落、标题、列表可以转换为引用
    const canTransformToQuote = ["NodeHeading", "NodeParagraph", "NodeList"].includes(type || "");
    
    if (canTransformToQuote) {
        await turnsIntoOneTransaction({
            protyle,
            selectsElement,
            type: "Blocks2Blockquote"
        });
        
        const result = selectsElement.length === 1 
            ? `${type} 转换为引用块` 
            : `批量转换为引用块: ${selectsElement.length} 个元素`;
        
        logCommandExecution({
            command: LIST_COMMANDS.TRANSFORM_TO_QUOTE,
            event,
            nodeElement,
            result,
            context: { 
                selectCount: selectsElement.length,
                sourceType: type
            }
        });
    }
    
    // 其他类型：使用 hint 插入引用标记（需要 hint 存在）
    if (!canTransformToQuote && protyle.hint) {
        protyle.hint.splitChar = "/";
        protyle.hint.lastIndex = -1;
        protyle.hint.fill(">" + Lute.Caret, protyle);
        
        logCommandExecution({
            command: LIST_COMMANDS.TRANSFORM_TO_QUOTE,
            event,
            nodeElement,
            result: "插入引用标记（通过 hint）",
            context: { sourceType: type }
        });
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("转换为引用块操作");
};


