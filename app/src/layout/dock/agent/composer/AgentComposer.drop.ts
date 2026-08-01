/** 用途：读取思源块拖放协议常量；使用范围：Composer dragover 和 drop 事件；解耦评估：平台常量经 Agent 外部依赖网关进入，业务文件不加载其定义模块。 */
import {Constants} from "./imports";
/** 用途：约束拖放流程的完整输入；使用范围：本文件块引用识别和插入；解耦评估：同一 Composer 领域的数据契约直接依赖。 */
import type {AgentComposerBlockDropOptions} from "./AgentComposer.types";

/** 清理拖放协议中的空标识和重复标识，保持原始顺序。 */
const uniqueBlockIds = (ids: string[]) =>
    [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

/**
 * 判断拖放数据是否携带思源块引用协议。
 * @同步豁免: 需要绝对同步的DOM访问 - dragover 事件必须在当前派发周期内决定是否调用 preventDefault，否则浏览器不会允许后续 drop。
 */
export const hasAgentBlockReferenceTransfer = (transfer: DataTransfer) =>
    Array.from(transfer.types).some((type) =>
        type.startsWith(Constants.SIYUAN_DROP_GUTTER) || type === Constants.SIYUAN_DROP_FILE);

/**
 * 从块标拖放或文件拖放协议中读取去重后的块标识。
 * @同步豁免: 需要绝对同步的DOM访问 - DataTransfer 仅保证在当前拖放事件回调中可读，异步延后可能失去数据访问权限。
 */
export const getDroppedAgentBlockIds = (transfer: DataTransfer) => {
    for (const type of transfer.types) {
        // 块标拖放把多个块标识编码在 MIME 类型字段中，需要按思源协议解码。
        if (type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            const gutterFields = type.slice(Constants.SIYUAN_DROP_GUTTER.length).split(Constants.ZWSP);
            return uniqueBlockIds((gutterFields[2] ?? "").split(","));
        }
    }
    return uniqueBlockIds(transfer.getData(Constants.SIYUAN_DROP_FILE).split(","));
};

/** 解析拖入的块标识并异步补全标题，全部解析完成后一次写入 Composer。 */
const insertDroppedMentions = async (transfer: DataTransfer, options: AgentComposerBlockDropOptions) => {
    const blockIds = getDroppedAgentBlockIds(transfer);
    if (blockIds.length === 0) {
        return;
    }
    const mentions = await Promise.all(blockIds.map(async (id) => ({
        id,
        label: await options.resolveLabel(id),
    })));
    options.insertMentions(mentions);
};

/** 在 dragover 派发周期内声明 Composer 接受块引用复制。 */
function handleAgentComposerDragOver(event: DragEvent) {
    const transfer = event.dataTransfer;
    if (!transfer || !hasAgentBlockReferenceTransfer(transfer)) {
        return;
    }
    event.preventDefault();
    transfer.dropEffect = "copy";
}

/** 在 drop 派发周期内接管块引用并启动标题解析。 */
function handleAgentComposerDrop(options: AgentComposerBlockDropOptions, event: DragEvent) {
    const transfer = event.dataTransfer;
    if (!transfer || !hasAgentBlockReferenceTransfer(transfer)) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    void insertDroppedMentions(transfer, options).catch(options.reportError);
}

/**
 * 为独立 Tiptap Composer 绑定思源块标与文档拖放协议。
 * @同步豁免: 生命周期 - 监听器必须在 Composer 创建调用栈内完成登记，确保返回句柄时拖放能力已经生效。
 */
export const bindAgentComposerBlockDrop = (options: AgentComposerBlockDropOptions) => {
    options.host.addEventListener("dragover", handleAgentComposerDragOver);
    options.host.addEventListener("drop", handleAgentComposerDrop.bind(undefined, options));
};
