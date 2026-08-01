/** 用途：发送附件上传请求；使用范围：附件仓储命令；解耦评估：具体网络入口由本领域网关集中暴露。 */
import {fetchSyncPost} from "./imports";
/** 用途：约束组合根提供的动态身份请求头；使用范围：附件上传。 */
import type {AgentRequestHeaders} from "./imports";
/** 用途：校验附件 API 数据包络；使用范围：附件上传；解耦评估：共享协议校验只由附件网关暴露。 */
import {requireAgentAPIData} from "./imports";
/** 用途：校验附件上传完整结果；使用范围：附件上传返回边界。 */
import type {AgentFileUploadResult} from "./AgentFileUpload.types";

/** 上传文件并保留 Kernel 返回的部分成功和逐文件失败。 */
export async function uploadAgentFiles(
    requestHeaders: AgentRequestHeaders,
    files: File[],
){
    const formData = new FormData();
    for (const file of files) {
        formData.append("file[]", file);
    }
    const response = await fetchSyncPost(
        "/api/ai/agent/uploadFiles",
        formData,
        requestHeaders({scope: "app"}),
    );
    const result = requireAgentAPIData<{succMap?: Record<string, string>; errFiles?: string[]}>(
        response,
        "Upload agent files",
    );
    const uploaded = Object.entries(result.succMap || {}).map(([name, path]) => ({name, path}));
    const failed = result.errFiles || [];
    if (uploaded.length === 0 && failed.length === 0) {
        throw new Error(response.msg || "Upload agent files returned no file result");
    }
    return {uploaded, failed, message: response.msg || ""} satisfies AgentFileUploadResult;
}
