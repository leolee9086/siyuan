import {beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../../app/AppFacade.fixture";

const runtime = vi.hoisted(() => ({
    fetchPost: vi.fn(),
}));

vi.mock("../../../src/util/network/fetch", () => ({
    fetchPost: runtime.fetchPost,
}));

import {fetchNewDailyNote} from "../../../src/util/file/mount";

describe("daily note navigation", () => {
    beforeEach(() => {
        runtime.fetchPost.mockReset();
    });

    it("opens the created note through the application facade", () => {
        runtime.fetchPost.mockImplementation((_url, _payload, callback) => {
            callback({data: {id: "daily-note-id"}});
        });
        const openBlock = vi.fn();
        const app = createTestAppFacade(openBlock);

        fetchNewDailyNote(app, "notebook-id");

        expect(runtime.fetchPost).toHaveBeenCalledWith(
            "/api/filetree/createDailyNote",
            expect.objectContaining({notebook: "notebook-id"}),
            expect.any(Function),
        );
        expect(openBlock).toHaveBeenCalledWith({
            id: "daily-note-id",
            action: ["cb-get-scroll", "cb-get-focus"],
        });
    });
});
