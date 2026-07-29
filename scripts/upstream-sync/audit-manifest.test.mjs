import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {buildAuditRecords, verifyAuditManifest, writeAuditManifest} from "./audit-manifest.mjs";

const git = (repo, args) => execFileSync("git", args, {cwd: repo, encoding: "utf8"}).trim();

const commitFile = (repo, name, content, subject) => {
    writeFileSync(join(repo, name), content);
    git(repo, ["add", name]);
    git(repo, ["commit", "-m", subject]);
    return git(repo, ["rev-parse", "HEAD"]);
};

test("generates and verifies a complete DAG while preserving audit decisions", () => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-manifest-"));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const base = commitFile(repo, "base.txt", "base\n", "base");
    git(repo, ["switch", "-c", "feature"]);
    const feature = commitFile(repo, "feature.txt", "feature\n", "feature");
    git(repo, ["switch", "main"]);
    const main = commitFile(repo, "main.txt", "main\n", "main");
    git(repo, ["merge", "--no-ff", "feature", "-m", "merge feature"]);
    const tip = git(repo, ["rev-parse", "HEAD"]);
    const output = join(repo, "audit");

    let records = buildAuditRecords({
        repo,
        upstreamBase: base,
        upstreamTip: tip,
        existingManifestPath: join(output, "commits.jsonl"),
    });
    assert.equal(records.length, 3);
    assert.equal(records.at(-1).commitType, "merge");
    assert.deepEqual(new Set(records.slice(0, 2).map((record) => record.sha)), new Set([feature, main]));
    writeAuditManifest({
        repo,
        output,
        cycle: {upstreamBase: base, upstreamTip: tip},
        records,
    });

    const lines = readFileSync(join(output, "commits.jsonl"), "utf8").trim().split("\n");
    const first = JSON.parse(lines[0]);
    first.audit.status = "verified";
    first.audit.disposition = "ported-exact";
    lines[0] = JSON.stringify(first);
    writeFileSync(join(output, "commits.jsonl"), lines.join("\n") + "\n");

    records = buildAuditRecords({
        repo,
        upstreamBase: base,
        upstreamTip: tip,
        existingManifestPath: join(output, "commits.jsonl"),
    });
    writeAuditManifest({repo, output, cycle: {upstreamBase: base, upstreamTip: tip}, records});
    assert.equal(records[0].audit.status, "verified");
    assert.equal(records[0].audit.disposition, "ported-exact");
    assert.deepEqual(verifyAuditManifest({repo, output}), {commitCount: 3, mergeCommitCount: 1});
});
