import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {unicode2Emoji} from "../../src/emoji/emoji.render";

describe("emoji rendering", () => {
    it("renders a Unicode code point", () => {
        assert.equal(unicode2Emoji("1f600"), "😀");
    });

    it("renders a compound Unicode sequence", () => {
        assert.equal(unicode2Emoji("2764-fe0f"), "❤️");
    });

    it("wraps rendered Unicode when requested", () => {
        assert.equal(unicode2Emoji("1f600", "emoji", true), '<span class="emoji">😀</span>');
    });
});
