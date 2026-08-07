import {afterEach, describe, expect, it, vi} from "vitest";
import {filePropertiesRepository} from "../../../src/sforge/fileBrowser/FileProperties.repository";
import {addFilesToFileTag} from "../../../src/sforge/fileBrowser/FileTags.repository";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("file tag mutation repository", () => {
    it("deduplicates authorized addresses and preserves existing tags before update", async () => {
        const request = {rootID: "agent-a", path: "output/hero.png"};
        vi.spyOn(filePropertiesRepository, "inspect").mockResolvedValue({
            items: [{
                request,
                properties: {revision: "r1"} as never,
                metadata: {
                    rootID: request.rootID, path: request.path, name: "hero.png", tags: ["Blue"], star: 0,
                    annotation: "", boundBlockId: "", source: "", sourceId: "", importTime: 1,
                },
                metadataPersisted: true, metadataWritable: true,
            }],
            successCount: 1, failureCount: 0, metadataFailureCount: 0,
        });
        const update = vi.spyOn(filePropertiesRepository, "update").mockResolvedValue({
            items: [{request, metadata: {} as never}], successCount: 1, failureCount: 0,
        });

        await addFilesToFileTag([request, request], " review ");

        expect(update).toHaveBeenCalledWith([{
            request, revision: "r1", patch: {tags: ["Blue", "review"]},
        }]);
    });

    it("rejects empty or non-authorized drops before writing", async () => {
        await expect(addFilesToFileTag([], "blue")).rejects.toThrow("已授权文件");
        await expect(addFilesToFileTag([{rootID: "agent-a", path: "output/a.png"}], " ")).rejects.toThrow("标签名称");
    });
});
