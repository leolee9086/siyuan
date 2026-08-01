/** 用途：约束 Agent 上传结果；使用范围：生成 Composer 附件链接；解耦评估：纯数据类型。 */
import type {AgentUploadedFile} from "./AgentFileUpload.types";

/** 编码 Markdown 链接中的单个路径段；斜杠和受控的 box 查询由调用方保留。 */
function encodeMarkdownPathSegment(segment: string) {
    return encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
        `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** 将 Kernel 返回的附件路径编码为 Markdown 目标，同时保留加密笔记本的受控 box 查询。 */
function encodeAgentUploadedFileTarget(target: string) {
    const boxQuery = /\?box=([A-Za-z0-9-]+)$/.exec(target);
    const pathPart = boxQuery ? target.slice(0, boxQuery.index) : target;
    const encodedPath = pathPart.replaceAll("\\", "/").split("/").map(encodeMarkdownPathSegment).join("/");
    // 正则捕获组在匹配成功时必定存在（[A-Za-z0-9-]+ 至少一个字符），
    // 此处仅消除 noUncheckedIndexedAccess 产生的 undefined 窄化。
    const boxId = boxQuery?.[1];
    return boxId === undefined ? encodedPath : `${encodedPath}?box=${encodeMarkdownPathSegment(boxId)}`;
}

/** 生成只包含纯文本标签和经过编码目标的附件 Markdown 链接。 */
/** @同步豁免: UI构建 */
export function formatAgentUploadedFileMarkdown(file: AgentUploadedFile) {
    const label = file.name
        // 清除控制字符，避免其混入 Markdown 链接标签；保持原有 C0/DEL 字符集不变。
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replaceAll("\\", "\\\\")
        .replaceAll("[", "\\[")
        .replaceAll("]", "\\]");
    return `[${label}](${encodeAgentUploadedFileTarget(file.path)})`;
}
