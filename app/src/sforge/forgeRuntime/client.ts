import {fetchSyncPost} from "../../util/network/fetch";
import {
    forgeRuntimeApprovalResponseSchema,
    forgeRuntimeRestartResponseSchema,
    forgeRuntimeStatusDataSchema,
} from "./types";
import type {
    ForgeRuntimeApprovalResponse,
    ForgeRuntimeRestartResponse,
    ForgeRuntimeStatusData,
} from "./types";
const forgeRuntimeWebUIHeaders = {"Content-Type": "application/json"};
const forgeSupervisorUnavailableMessage = "Forge Supervisor 控制面未连接";

const requireSuccessfulResponse = (response: IWebSocketData, operation: string) => {
    if (response.code !== 0) {
        throw new Error(response.msg || `${operation} failed`);
    }
    return response.data;
};

export class ForgeRuntimeClient {
    public async getStatus(): Promise<ForgeRuntimeStatusData> {
        const response = await fetchSyncPost("/api/s-forge/forge/runtime/status", {}, forgeRuntimeWebUIHeaders,
            {processMessage: false});
        if (response.code !== 0 && response.msg === forgeSupervisorUnavailableMessage) {
            return {available: false};
        }
        return forgeRuntimeStatusDataSchema.parse(requireSuccessfulResponse(response, "Forge Runtime status"));
    }

    public async restart(reason: string): Promise<ForgeRuntimeRestartResponse> {
        const response = await fetchSyncPost("/api/s-forge/forge/runtime/restart", {reason}, forgeRuntimeWebUIHeaders);
        return forgeRuntimeRestartResponseSchema.parse(requireSuccessfulResponse(response, "Forge Runtime restart"));
    }

    public async approveProtectedTests(jobId: string, revision: string): Promise<ForgeRuntimeApprovalResponse> {
        const response = await fetchSyncPost("/api/s-forge/forge/runtime/approveProtectedTests", {jobId, revision}, forgeRuntimeWebUIHeaders);
        return forgeRuntimeApprovalResponseSchema.parse(requireSuccessfulResponse(response, "Forge Runtime approval"));
    }

    public async rejectProtectedTests(jobId: string, revision: string): Promise<ForgeRuntimeApprovalResponse> {
        const response = await fetchSyncPost("/api/s-forge/forge/runtime/rejectProtectedTests", {jobId, revision}, forgeRuntimeWebUIHeaders);
        return forgeRuntimeApprovalResponseSchema.parse(requireSuccessfulResponse(response, "Forge Runtime rejection"));
    }
}
