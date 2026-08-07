import {describe, expect, it, vi} from "vitest";
import {useFileBrowserSearch} from "../../../src/sforge/fileBrowser/useFileBrowserSearch";
import type {FileBrowserQueryRepository} from "../../../src/sforge/fileBrowser/FileBrowser.query.types";

function repository(search: FileBrowserQueryRepository["search"]): FileBrowserQueryRepository {
    return {search};
}

describe("file browser search controller", () => {
    it("keeps only the newest response", async () => {
        let resolveFirst: (value: {assets: never[]; totalCount: number; pageCount: number}) => void = () => undefined;
        const first = new Promise<{assets: never[]; totalCount: number; pageCount: number}>(resolve => {
            resolveFirst = resolve;
        });
        const search = vi.fn()
            .mockReturnValueOnce(first)
            .mockResolvedValueOnce({assets: [], totalCount: 2, pageCount: 1});
        const controller = useFileBrowserSearch(repository(search));

        const firstRequest = controller.search({keyword: "old"});
        const secondRequest = controller.search({keyword: "new"});
        await secondRequest;
        resolveFirst({assets: [], totalCount: 1, pageCount: 1});
        await firstRequest;

        expect(controller.result.value.totalCount).toBe(2);
        expect(controller.loading.value).toBe(false);
        expect(controller.error.value).toBe("");
    });

    it("exposes errors and clear invalidates an in-flight result", async () => {
        let rejectSearch: (reason?: unknown) => void = () => undefined;
        const pending = new Promise<never>((_resolve, reject) => {
            rejectSearch = reject;
        });
        const controller = useFileBrowserSearch(repository(vi.fn().mockReturnValue(pending)));
        const request = controller.search({allRoots: true});
        controller.clear();
        rejectSearch(new Error("query failed"));
        await request;

        expect(controller.result.value.totalCount).toBe(0);
        expect(controller.error.value).toBe("");
        expect(controller.loading.value).toBe(false);
    });
});
