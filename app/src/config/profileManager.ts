/**
 * 用途：提供 HTTP POST 请求的封装，用于 SiYuan kernel API 通信。
 * 使用范围：配置文件的读写操作（putFile / getFile / readDir / removeFile）。
 * 解耦评估：网络请求是基础设施访问，通过 imports.ts 转发避免路径耦合。
 */
import { fetchSyncPost } from "./imports";
/**
 * 用途：提供 HTTP POST 请求的封装，返回原始响应（用于文件读取）。
 * 使用范围：配置文件的读取操作（getFile），需要获取原始响应而非标准包裹格式。
 * 解耦评估：同 fetchSyncPost，通过 imports.ts 转发。
 */
import { fetchSyncPostRaw } from "./imports";
/**
 * 用途：生成全局唯一标识符，用于创建新的 Profile ID。
 * 使用范围：createProfile 方法。
 * 解耦评估：UUID 生成是通用工具，通过 imports.ts 转发。
 */
import { genUUID } from "./imports";
/**
 * 用途：Profile 数据相关的类型定义。
 * 使用范围：ProfileManager 类的所有方法签名。
 * 解耦评估：类型导入，不产生运行时依赖。
 */
import type { Profile } from "./profile.types";
/**
 * 用途：命名空间状态类型。
 * 使用范围：getActiveProfileId、setActiveProfileId 方法。
 * 解耦评估：类型导入，不产生运行时依赖。
 */
import type { NamespaceState } from "./profile.types";
/**
 * 用途：getFile API 原始响应类型。
 * 使用范围：loadProfile、getActiveProfileId 中解析文件内容。
 * 解耦评估：类型导入，不产生运行时依赖。
 */
import type { GetFileResponse } from "./profile.types";
/**
 * 用途：类型守卫函数，用于安全地将 unknown 值转换为 Profile / NamespaceState。
 * 使用范围：loadProfile、getActiveProfileId 中的 JSON 解析结果转换。
 * 解耦评估：类型守卫在 guard 文件中集中管理，符合架构规范。
 */
/**
 * 用途：类型守卫函数，用于检测对象是否包含 code 属性。
 * 使用范围：isErrorResponse 中判断 API 错误响应。
 * 解耦评估：类型守卫在 guard 文件中集中管理，符合架构规范。
 */
import { hasCodeProperty } from "./sforge.guard";
/**
 * 用途：类型守卫函数，将 unknown 安全转换为 Profile 类型。
 * 使用范围：loadProfile 中解析 API 返回的文件内容。
 * 解耦评估：类型守卫在 guard 文件中集中管理，符合架构规范。
 */
import { asProfile } from "./sforge.guard";
/**
 * 用途：类型守卫函数，将 unknown 安全转换为 NamespaceState 类型。
 * 使用范围：getActiveProfileId 中解析 API 返回的状态文件内容。
 * 解耦评估：类型守卫在 guard 文件中集中管理，符合架构规范。
 */
import { asNamespaceState } from "./sforge.guard";

/**
 * 用途：构建文件上传所需的 FormData 参数。
 * 使用范围：saveProfile、ensureNamespace、setActiveProfileId 等涉及文件写入的方法。
 */
const getFormDataParams = (path: string, file?: File | string, isDir: boolean = false) => {
    const formData = new FormData();
    formData.append("path", path);
    formData.append("isDir", isDir.toString());
    formData.append("modTime", Date.now().toString());

    if (isDir) {
        formData.append("file", "");
        return formData;
    }

    if (!file) {
        return formData;
    }

    // File 对象直接上传
    if (file instanceof File) {
        formData.append("file", file);
        return formData;
    }

    const blob = new Blob([file], { type: "application/json" });
    formData.append("file", new File([blob], path.split("/").pop() || "data.json", { lastModified: Date.now() }));
    return formData;
};

/**
 * 用途：读取指定命名空间下所有文件的名称列表。
 * 使用范围：listProfiles、getActiveProfileId 需要获取目录内容时调用。
 */
const getProfileFileList = async (basePath: string) => {
    const response = await fetchSyncPost("/api/file/readDir", { path: basePath });
    if (!response || !response.data) {
        return [];
    }
    const fileList: { name: string }[] = response.data;
    return fileList.map(f => f.name);
};

/**
 * 用途：判断 API 响应是否为错误结果（包含非零 code 字段）。
 * 使用范围：loadProfile、getActiveProfileId 中过滤错误响应。
 */
const isErrorResponse = (response: unknown) => {
    if (typeof response !== "object" || response === null) {
        return false;
    }
    if (!hasCodeProperty(response)) {
        return false;
    }
    return typeof response.code === "number" && response.code !== 0;
};

// ========== 模块级实例管理（替代原 static getInstance） ==========

const profileManagerInstances = new Map<string, ProfileManager>();

/**
 * 用途：获取 ProfileManager 的单例实例。
 * 使用范围：sforge.ts 等配置文件管理入口。
 */
export const getProfileManagerInstance = async (namespace: string) => {
    // 未初始化时创建新的实例
    if (!profileManagerInstances.has(namespace)) {
        profileManagerInstances.set(namespace, new ProfileManager(namespace));
    }
    // instances 在此 namespace 下必定已存在（上一行刚 set）
    const instance = profileManagerInstances.get(namespace);
    if (!instance) {
        throw new Error(`ProfileManager instance for "${namespace}" unexpectedly missing`);
    }
    return instance;
};

/**
 * 用途：管理特定命名空间下的配置文件（Profile）的 CRUD 操作。
 * 使用范围：AI 模型配置、插件配置等需要持久化用户配置的场景。
 */
export class ProfileManager {
    private namespace: string;
    private basePath: string;

    /** 用途：初始化 ProfileManager 实例。使用范围：仅限 getProfileManagerInstance 调用。 */
    constructor(namespace: string) {
        this.namespace = namespace;
        this.basePath = `/data/storage/profiles/${namespace}`;
    }

    /** 用途：确保配置文件的存储目录存在。调用时机：首次访问命名空间时。 */
    async ensureNamespace() {
        const formData = getFormDataParams(this.basePath, undefined, true);
        await fetchSyncPost("/api/file/putFile", formData);
    }

    /** 用途：列出当前命名空间下所有 Profile。调用时机：获取配置文件列表时。 */
    async listProfiles() {
        const fileNames = await getProfileFileList(this.basePath);
        const profiles: Profile[] = [];
        for (const name of fileNames) {
            // 跳过非 .json 文件和 _state 系统文件
            if (!name.endsWith(".json") || name.startsWith("_state")) {
                continue;
            }
            const p = await this.loadProfile(name.replace(".json", ""));
            if (p) {
                profiles.push(p);
            }
        }
        return profiles;
    }

    /** 用途：按 ID 加载单个 Profile。调用时机：读取指定配置时。 */
    async loadProfile<T>(id: string) {
        const response = await fetchSyncPostRaw<GetFileResponse<Profile<T>>>("/api/file/getFile", { path: `${this.basePath}/${id}.json` });
        if (!response) {
            return null;
        }
        if (isErrorResponse(response)) {
            return null;
        }
        let data: unknown = response;
        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch {
                return null;
            }
        }
        const profile = asProfile<T>(data);
        if (!profile || !profile.id) {
            return null;
        }
        return profile;
    }

    /** 用途：保存单个 Profile 到文件。调用时机：创建或更新配置时。 */
    async saveProfile<T>(profile: Profile<T>) {
        const formData = getFormDataParams(`${this.basePath}/${profile.id}.json`, JSON.stringify(profile));
        await fetchSyncPost("/api/file/putFile", formData);
    }

    /** 用途：创建一个新的 Profile。调用时机：用户添加新配置时。 */
    async createProfile<T>(name: string, defaultData: T) {
        const profile: Profile<T> = {
            id: genUUID(),
            name,
            data: defaultData,
        };
        await this.saveProfile(profile);
        return profile;
    }

    /** 用途：删除指定 ID 的 Profile 文件。调用时机：用户移除配置时。 */
    async deleteProfile(id: string) {
        await fetchSyncPost("/api/file/removeFile", { path: `${this.basePath}/${id}.json` });
    }

    /** 用途：获取当前活跃的 Profile ID。调用时机：初始化配置时判断默认配置。 */
    async getActiveProfileId() {
        const fileNames = await getProfileFileList(this.basePath);
        // 不存在 _state.json 表示未设置活跃配置
        if (!fileNames.includes("_state.json")) {
            return "";
        }
        const response = await fetchSyncPostRaw<GetFileResponse<NamespaceState>>("/api/file/getFile", { path: `${this.basePath}/_state.json` });
        if (!response) {
            return "";
        }
        if (isErrorResponse(response)) {
            return "";
        }
        let data: unknown = response;
        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch {
                return "";
            }
        }
        const state = asNamespaceState(data);
        return state.activeProfileId || "";
    }

    /** 用途：设置当前活跃的 Profile ID。调用时机：用户切换默认配置时。 */
    async setActiveProfileId(id: string) {
        const state: NamespaceState = { activeProfileId: id };
        const formData = getFormDataParams(`${this.basePath}/_state.json`, JSON.stringify(state));
        await fetchSyncPost("/api/file/putFile", formData);
    }
}
