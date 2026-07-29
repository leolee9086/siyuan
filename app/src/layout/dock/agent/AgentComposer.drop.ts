import {Constants} from "../../../constants";

type AgentComposerMention = {id: string; label: string};

type AgentComposerBlockDropOptions = {
    host: HTMLElement;
    resolveLabel: (id: string) => Promise<string>;
    insertMentions: (mentions: AgentComposerMention[]) => void;
    reportError: (error: unknown) => void;
};

const uniqueBlockIds = (ids: string[]): string[] =>
    [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

export const hasAgentBlockReferenceTransfer = (transfer: DataTransfer): boolean =>
    Array.from(transfer.types).some((type) =>
        type.startsWith(Constants.SIYUAN_DROP_GUTTER) || type === Constants.SIYUAN_DROP_FILE);

export const getDroppedAgentBlockIds = (transfer: DataTransfer): string[] => {
    for (const type of transfer.types) {
        if (type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            const gutterFields = type.slice(Constants.SIYUAN_DROP_GUTTER.length).split(Constants.ZWSP);
            return uniqueBlockIds((gutterFields[2] ?? "").split(","));
        }
    }
    return uniqueBlockIds(transfer.getData(Constants.SIYUAN_DROP_FILE).split(","));
};

const insertDroppedMentions = async (
    transfer: DataTransfer,
    options: AgentComposerBlockDropOptions,
): Promise<void> => {
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

/** 为独立 Tiptap Composer 绑定思源块标与文档拖放协议。 */
export const bindAgentComposerBlockDrop = (options: AgentComposerBlockDropOptions): void => {
    options.host.addEventListener("dragover", (event: DragEvent) => {
        const transfer = event.dataTransfer;
        if (!transfer || !hasAgentBlockReferenceTransfer(transfer)) {
            return;
        }
        event.preventDefault();
        transfer.dropEffect = "copy";
    });
    options.host.addEventListener("drop", (event: DragEvent) => {
        const transfer = event.dataTransfer;
        if (!transfer || !hasAgentBlockReferenceTransfer(transfer)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        void insertDroppedMentions(transfer, options).catch(options.reportError);
    });
};
