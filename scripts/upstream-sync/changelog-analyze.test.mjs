import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {
    analyzeChangelog,
    buildIssueIndex,
    parseChangelog,
} from "./changelog-analyze.mjs";

const git = (repo, args) => execFileSync("git", args, {cwd: repo, encoding: "utf8"}).trim();

const commitFile = (repo, name, content, subject) => {
    writeFileSync(join(repo, name), content);
    git(repo, ["add", name]);
    git(repo, ["commit", "-m", subject]);
    return git(repo, ["rev-parse", "HEAD"]);
};

test("parses changelog sections and linked issue entries", () => {
    const markdown = [
        "## Overview",
        "",
        "### Feature",
        "",
        "* [Support MCP](https://github.com/siyuan-note/siyuan/issues/13795)",
        "* [AI Agent](https://github.com/siyuan-note/siyuan/issues/17797)",
        "",
        "### Enhancement",
        "",
        "* [Support heading numbering](https://github.com/siyuan-note/siyuan/issues/522)",
        "",
        "### Bugfix",
        "",
        "* [Some security vulnerabilities](https://github.com/siyuan-note/siyuan/issues/18335)",
    ].join("\n");
    const entries = parseChangelog(markdown);
    assert.equal(entries.length, 4);
    assert.deepEqual(entries[0], {
        category: "Feature",
        title: "Support MCP",
        issueType: "issues",
        issue: 13795,
    });
    assert.equal(entries[2].category, "Enhancement");
    assert.equal(entries[3].category, "Bugfix");
});

test("parses pull-request style links with the same issue type", () => {
    const entries = parseChangelog(
        "### Enhancement\n\n* [Disable iframe event](https://github.com/siyuan-note/siyuan/pull/18334)\n",
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0].issueType, "pull");
    assert.equal(entries[0].issue, 18334);
});

test("builds an issue index from commit subjects", () => {
    const commits = [
        {sha: "a".repeat(40), date: "2026-08-01", subject: ":art: Fix A https://github.com/siyuan-note/siyuan/issues/522"},
        {sha: "b".repeat(40), date: "2026-08-02", subject: ":art: Fix B https://github.com/siyuan-note/siyuan/issues/522 https://github.com/siyuan-note/siyuan/issues/8554"},
        {sha: "c".repeat(40), date: "2026-08-03", subject: ":bug: Unrelated https://example.com/issues/999"},
    ];
    const index = buildIssueIndex(commits);
    assert.equal(index.get(522).length, 2);
    assert.equal(index.get(8554).length, 1);
    assert.equal(index.has(999), false);
});

test("maps changelog entries to upstream commits from a real git repo", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-changelog-analyze-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const first = commitFile(
        repo, "a.txt", "a\n",
        ":art: Fix A https://github.com/siyuan-note/siyuan/issues/522",
    );
    const second = commitFile(
        repo, "b.txt", "b\n",
        ":art: Fix B https://github.com/siyuan-note/siyuan/issues/8554",
    );
    const third = commitFile(repo, "c.txt", "c\n", ":art: Other change");

    const entries = parseChangelog(
        [
            "### Enhancement",
            "",
            "* [Support heading numbering](https://github.com/siyuan-note/siyuan/issues/522)",
            "* [Support cross-block selection](https://github.com/siyuan-note/siyuan/issues/8554)",
            "* [Support MCP](https://github.com/siyuan-note/siyuan/issues/13795)",
        ].join("\n"),
    );
    const commits = [
        {sha: first, date: "2026-08-01", subject: ":art: Fix A https://github.com/siyuan-note/siyuan/issues/522"},
        {sha: second, date: "2026-08-02", subject: ":art: Fix B https://github.com/siyuan-note/siyuan/issues/8554"},
        {sha: third, date: "2026-08-03", subject: ":art: Other change"},
    ];
    const result = analyzeChangelog({entries, commits});

    assert.equal(result.summary.totalEntries, 3);
    assert.equal(result.summary.matchedEntries, 2);
    assert.equal(result.summary.unmatchedEntries, 1);
    const byIssue = new Map(result.entries.map((entry) => [entry.issue, entry]));
    assert.deepEqual(byIssue.get(522).commits, [first]);
    assert.deepEqual(byIssue.get(8554).commits, [second]);
    assert.deepEqual(byIssue.get(13795).commits, []);
    assert.equal(result.unmatched[0].issue, 13795);
});
