import { fetchSyncPost, fetchSyncPostRaw } from "../util/fetch";
import { genUUID } from "../util/genID";
import { Profile, NamespaceState, GetFileResponse } from "./profile.types";

export class ProfileManager {
    private static instances: Map<string, ProfileManager> = new Map();
    private namespace: string;
    private basePath: string;

    private constructor(namespace: string) {
        this.namespace = namespace;
        this.basePath = `/data/storage/profiles/${namespace}`;
    }

    public static getInstance(namespace: string): ProfileManager {
        if (!ProfileManager.instances.has(namespace)) {
            ProfileManager.instances.set(namespace, new ProfileManager(namespace));
        }
        return ProfileManager.instances.get(namespace)!;
    }

    private static getParams(path: string, file?: File | string, isDir: boolean = false) {
        const formData = new FormData();
        formData.append("path", path);
        formData.append("isDir", isDir.toString());
        formData.append("modTime", Date.now().toString());

        if (isDir) {
            // For mkdir: file must be an empty string
            formData.append("file", "");
            return formData;
        }

        if (!file) {
            return formData;
        }

        if (file instanceof File) {
            formData.append("file", file);
            return formData;
        }

        const blob = new Blob([file], { type: "application/json" });
        formData.append("file", new File([blob], path.split("/").pop() || "data.json", { lastModified: Date.now() }));
        return formData;
    }

    public async ensureNamespace(): Promise<void> {
        const formData = ProfileManager.getParams(this.basePath, undefined, true);
        const response = await fetchSyncPost("/api/file/putFile", formData);
        console.log("ensureNamespace response:", response);
    }

    private async getFileList(): Promise<string[]> {
        const response = await fetchSyncPost("/api/file/readDir", { path: this.basePath });
        console.log("getFileList response:", response);
        if (!response || !response.data) {
            return [];
        }
        return (response.data as any[]).map(f => f.name);
    }

    public async listProfiles(): Promise<Profile[]> {
        const fileNames = await this.getFileList();
        console.log("listProfiles fileNames:", fileNames);
        const profiles: Profile[] = [];
        for (const name of fileNames) {
            if (name.endsWith(".json") && !name.startsWith("_state")) {
                const p = await this.loadProfile(name.replace(".json", ""));
                if (p) {
                    profiles.push(p);
                }
            }
        }
        return profiles;
    }

    public async loadProfile<T>(id: string): Promise<Profile<T> | null> {
        const response = await fetchSyncPostRaw<GetFileResponse<Profile<T>>>("/api/file/getFile", { path: `${this.basePath}/${id}.json` });
        console.log("loadProfile response for", id, ":", response);

        // getFile API returns file content directly, not wrapped in {code, data}
        // It can be a string (file content) or parsed JSON object, or {code, msg} on error
        if (!response) {
            return null;
        }

        // If it's an error response with code (use type guard)
        if (typeof response === "object" && response !== null && "code" in response && typeof response.code === "number" && response.code !== 0) {
            return null;
        }

        // Response IS the profile directly (not wrapped)
        let data = response;

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Failed to parse profile JSON:", e);
                return null;
            }
        }

        // Validate it looks like a Profile
        const profile = data as unknown as Profile<T>;
        if (!profile || !profile.id) {
            return null;
        }

        return profile;
    }

    public async saveProfile<T>(profile: Profile<T>): Promise<void> {
        const formData = ProfileManager.getParams(`${this.basePath}/${profile.id}.json`, JSON.stringify(profile));
        const response = await fetchSyncPost("/api/file/putFile", formData);
        console.log("saveProfile response:", response);
    }

    public async createProfile<T>(name: string, defaultData: T): Promise<Profile<T>> {
        const profile: Profile<T> = {
            id: genUUID(),
            name,
            data: defaultData
        };
        await this.saveProfile(profile);
        return profile;
    }

    public async deleteProfile(id: string): Promise<void> {
        await fetchSyncPost("/api/file/removeFile", { path: `${this.basePath}/${id}.json` });
    }

    public async getActiveProfileId(): Promise<string> {
        const fileNames = await this.getFileList();
        if (!fileNames.includes("_state.json")) {
            return "";
        }
        const response = await fetchSyncPostRaw<GetFileResponse<NamespaceState>>("/api/file/getFile", { path: `${this.basePath}/_state.json` });

        // getFile API returns file content directly, not wrapped in {code, data}
        // It can be a string (file content) or parsed JSON object, or {code, msg} on error
        if (!response) {
            return "";
        }

        // If it's an error response with code (use type guard)
        if (typeof response === "object" && response !== null && "code" in response && typeof response.code === "number" && response.code !== 0) {
            return "";
        }

        // Response IS the state directly (not wrapped)
        let data = response;

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                return "";
            }
        }
        return (data as unknown as NamespaceState).activeProfileId || "";
    }

    public async setActiveProfileId(id: string): Promise<void> {
        const state: NamespaceState = { activeProfileId: id };
        const formData = ProfileManager.getParams(`${this.basePath}/_state.json`, JSON.stringify(state));
        await fetchSyncPost("/api/file/putFile", formData);
    }
}
