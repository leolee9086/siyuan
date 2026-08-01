import {describe, expect, it} from "vitest";
import {formatAgentUploadedFileMarkdown} from "../../../../src/layout/dock/agent/attachments/AgentUploadedFile.markdown";

describe("Agent uploaded file Markdown", () => {
    it("escapes the label and encodes Markdown-significant path characters", () => {
        expect(formatAgentUploadedFileMarkdown({
            name: "draft[1]\\line\n.txt",
            path: "assets/draft #?%(1).txt",
        })).toBe("[draft\\[1\\]\\\\line .txt](assets/draft%20%23%3F%25%281%29.txt)");
    });

    it("preserves path separators and the controlled encrypted-notebook query", () => {
        expect(formatAgentUploadedFileMarkdown({
            name: "report.txt",
            path: "assets/nested/report 100%.txt?box=20260729120000-abcdefg",
        })).toBe("[report.txt](assets/nested/report%20100%25.txt?box=20260729120000-abcdefg)");
    });

    it("encodes an existing percent sequence as literal filename content", () => {
        expect(formatAgentUploadedFileMarkdown({
            name: "literal.txt",
            path: "assets/literal%20name.txt",
        })).toBe("[literal.txt](assets/literal%2520name.txt)");
    });
});
