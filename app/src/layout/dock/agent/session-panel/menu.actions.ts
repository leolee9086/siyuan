/** 用途：读取会话及目录摘要；使用范围：生成标准菜单命令；解耦评估：纯类型输入已通过参数传递，导入仅用于静态约束。 */
import type {SessionIndexItem} from "../SessionStore.types";
/** 用途：约束目录菜单命令结构；使用范围：本模块输出；解耦评估：同目录纯类型契约，不产生运行时耦合。 */
import type {TaskDirectoryMenuAction} from "../SessionStore.types";

/**
 * 返回会话可执行的目录管理命令。菜单可见性不表示授权，后端仍需校验每次请求携带的 owner armor。
 * 用户点击“更多”时必须同步生成完整菜单项，异步化会造成空菜单闪烁并破坏当前菜单生命周期。
 * @同步豁免: UI构建
 */
export function buildTaskDirectoryMenuActions(session: SessionIndexItem, options: {canBindTaskDirectories?: boolean} = {}) {
    const binding = session.taskDirectory;
    const actions: TaskDirectoryMenuAction[] = [];
    const canBindTaskDirectories = options.canBindTaskDirectories !== false;
    // 已有主目录摘要对本地和远程端都可见，不代表扩大或新增授权。
    if (binding?.main) {
        actions.push({
            action: "summary",
            icon: "iconWorkspace",
            label: `主任务目录：${binding.main.name} (${binding.main.permission})`,
            disabled: true,
        });
    }
    if (canBindTaskDirectories) {
        actions.push({
            action: "bind-main",
            icon: "iconWorkspace",
            label: binding?.main ? "更换主任务目录" : "绑定主任务目录",
        });
    }
    // 只有主目录建立后，附加目录才有明确的任务根和权限上下文。
    if (binding?.main && canBindTaskDirectories) {
        actions.push(
            {action: "add", icon: "iconPreview", label: "添加只读目录", permission: "read-only"},
            {action: "add", icon: "iconEdit", label: "添加读写目录", permission: "read-write"},
            {action: "add", icon: "iconTerminal", label: "添加命令目录", permission: "command"},
        );
    }
    // 存在附加目录时不允许单独解除主目录，避免留下失去主任务根的 grant 集合。
    if (binding?.main && !binding.directories?.length) {
        actions.push({action: "unbind", icon: "iconClose", label: "解除主任务目录", directoryID: "main"});
    }
    for (const grant of binding?.directories || []) {
        actions.push({
            action: "unbind",
            icon: "iconClose",
            label: `解除目录：${grant.name} (${grant.permission})`,
            directoryID: grant.id,
        });
    }
    return actions;
}
