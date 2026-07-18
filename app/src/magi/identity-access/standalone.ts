/** 用途：独立页面依赖；使用范围：环境初始化和挂载；解耦评估：跨目录依赖由根网关集中转发。 */
import * as imports from "./imports";
/** 用途：共享面板挂载；使用范围：独立页面入口；解耦评估：同模块子目录的稳定适配器。 */
import { mountIdentityAccess } from "./components/mount";

/** 启动独立 Identity Access 页面并在失败时渲染稳定错误状态。 */
const startIdentityAccess = async () => {
    const root = document.getElementById("magi-identity-root");
    if (!root) {
        throw new Error("Missing #magi-identity-root mount node");
    }
    try {
        await imports.bootstrapMagiSiyuan("magi-identity");
        mountIdentityAccess(root, { hostKind: "standalone" });
    } catch (error) {
        console.error("[magi-identity] bootstrap failed:", error);
        root.textContent = "IDENTITY ACCESS BOOTSTRAP FAILED";
    }
};

void startIdentityAccess();
