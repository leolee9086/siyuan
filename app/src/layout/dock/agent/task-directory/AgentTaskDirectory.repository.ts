/** 用途：发送任务目录 API 请求；使用范围：目录仓储；解耦评估：具体网络入口只由目录网关暴露。 */
import {fetchSyncPost} from "./imports";
/** 用途：接收动态身份请求头能力；使用范围：全部目录请求。 */
import type {AgentRequestHeaders} from "./imports";
/** 用途：校验带数据响应；使用范围：目录查询和绑定；解耦评估：共享协议校验只由目录网关暴露。 */
import {requireAgentAPIData} from "./imports";
/** 用途：校验命令响应；使用范围：目录解除；解耦评估：共享协议校验只由目录网关暴露。 */
import {requireAgentAPISuccess} from "./imports";
/** 用途：约束目录绑定响应；使用范围：目录仓储。 */
import type {TaskDirectoryBinding} from "./AgentTaskDirectory.types";
/** 用途：约束附加目录权限；使用范围：目录添加命令。 */
import type {TaskDirectoryPermission} from "./AgentTaskDirectory.types";

/** 读取当前连接是否具备新增或更换任务目录绑定的资格。 */
export async function canBindAgentTaskDirectories(requestHeaders: AgentRequestHeaders) {
    const response = await fetchSyncPost(
        "/api/ai/agent/taskDirectoryCapabilities",
        {},
        requestHeaders(),
    );
    const data = requireAgentAPIData<Record<string, unknown>>(
        response,
        "Read agent task-directory capabilities",
    );
    if (typeof data.canBindTaskDirectories !== "boolean") {
        throw new Error("Read agent task-directory capabilities returned invalid data");
    }
    return data.canBindTaskDirectories;
}

/** 读取会话可见的任务目录摘要。 */
export async function listAgentTaskDirectories(requestHeaders: AgentRequestHeaders, id: string) {
    const response = await fetchSyncPost("/api/ai/agent/lsTaskDirectories", {id}, requestHeaders());
    return requireAgentAPIData<TaskDirectoryBinding | null>(response, "List agent task directories");
}

/** 绑定会话主任务目录。 */
export async function bindAgentTaskDirectory(requestHeaders: AgentRequestHeaders, id: string, path: string) {
    const response = await fetchSyncPost(
        "/api/ai/agent/bindTaskDirectory",
        {sessionID: id, path},
        requestHeaders({scope: "app"}),
    );
    return requireAgentAPIData<TaskDirectoryBinding>(response, "Bind agent task directory");
}

/** 添加带有明确权限的附加任务目录。 */
export async function addAgentTaskDirectory(
    requestHeaders: AgentRequestHeaders,
    input: Readonly<{id: string; path: string; permission: TaskDirectoryPermission}>,
) {
    const response = await fetchSyncPost(
        "/api/ai/agent/addTaskDirectory",
        {sessionID: input.id, path: input.path, permission: input.permission},
        requestHeaders({scope: "app"}),
    );
    return requireAgentAPIData<TaskDirectoryBinding>(response, "Add agent task directory");
}

/** 解除主目录或指定附加目录 capability。 */
export async function unbindAgentTaskDirectory(
    requestHeaders: AgentRequestHeaders,
    id: string,
    directoryID = "main",
) {
    const response = await fetchSyncPost(
        "/api/ai/agent/unbindTaskDirectory",
        {sessionID: id, directoryID},
        requestHeaders({scope: "app"}),
    );
    requireAgentAPISuccess(response, "Unbind agent task directory");
}
