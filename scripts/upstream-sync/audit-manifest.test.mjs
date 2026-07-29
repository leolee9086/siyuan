import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {
    buildAuditRecords,
    loadCycleForRegeneration,
    refreshAuditManifest,
    verifyAuditManifest,
    writeAuditManifest,
} from "./audit-manifest.mjs";

const git = (repo, args) => execFileSync("git", args, {cwd: repo, encoding: "utf8"}).trim();

const commitFile = (repo, name, content, subject) => {
    writeFileSync(join(repo, name), content);
    git(repo, ["add", name]);
    git(repo, ["commit", "-m", subject]);
    return git(repo, ["rev-parse", "HEAD"]);
};

test("generates and verifies a complete DAG while preserving audit decisions", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-manifest-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
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
    assert.deepEqual(verifyAuditManifest({repo, output}), {
        commitCount: 3,
        mergeCommitCount: 1,
        revertCommitCount: 0,
        mappedUpstreamCommitCount: 0,
    });
});

test("classifies reverts and derives local mappings from commit trailers deterministically", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-mapping-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const upstreamBase = commitFile(repo, "base.txt", "base\n", "base");

    git(repo, ["switch", "-c", "candidate"]);
    const localBase = commitFile(repo, "local.txt", "local\n", "local base");
    git(repo, ["switch", "-c", "upstream", upstreamBase]);
    const upstreamCommit = commitFile(repo, "upstream.txt", "upstream\n", "upstream behavior");
    git(repo, ["revert", "--no-edit", upstreamCommit]);
    const upstreamTip = git(repo, ["rev-parse", "HEAD"]);

    git(repo, ["switch", "candidate"]);
    const message = [
        "port upstream behavior",
        "",
        `Upstream-Commit: ${upstreamCommit}`,
        "Upstream-Series: fixture/upstream-behavior",
        "Upstream-Disposition: semantic-port",
        "Upstream-Audit: docs/upstream-sync/fixture/commits.jsonl",
    ].join("\n");
    const candidateHead = commitFile(repo, "port.txt", "port\n", message);
    const output = join(repo, "audit");
    const build = () => buildAuditRecords({
        repo,
        upstreamBase,
        upstreamTip,
        localBase,
        candidateHead,
        existingManifestPath: join(output, "commits.jsonl"),
    });

    const records = build();
    assert.equal(records.length, 2);
    const portedRecord = records.find((record) => record.sha === upstreamCommit);
    const revertRecord = records.find((record) => record.sha === upstreamTip);
    assert.equal(revertRecord.commitType, "revert");
    assert.deepEqual(revertRecord.audit.relationships.reverts, [upstreamCommit]);
    assert.deepEqual(portedRecord.audit.relationships.revertedBy, [upstreamTip]);
    assert.deepEqual(portedRecord.audit.localCommits, [candidateHead]);
    assert.equal(portedRecord.audit.mappingEvidence[0].declaredDisposition, "semantic-port");

    const cycle = {
        upstreamBase,
        upstreamTip,
        localBase,
        candidateHead,
    };
    writeAuditManifest({repo, output, cycle, records});
    const firstCycle = readFileSync(join(output, "cycle.json"), "utf8");
    const firstManifest = readFileSync(join(output, "commits.jsonl"), "utf8");
    writeAuditManifest({repo, output, cycle, records: build()});
    assert.equal(readFileSync(join(output, "cycle.json"), "utf8"), firstCycle);
    assert.equal(readFileSync(join(output, "commits.jsonl"), "utf8"), firstManifest);
});

test("preserves rolling delivery configuration while refreshing generated cycle fields", (context) => {
    const output = mkdtempSync(join(tmpdir(), "sforge-audit-cycle-"));
    context.after(() => rmSync(output, {recursive: true, force: true}));
    writeFileSync(join(output, "cycle.json"), JSON.stringify({
        schemaVersion: 1,
        candidateHead: "old-head",
        mainBranch: "multipleAI",
        deliveryStrategy: {
            mode: "rolling-verified-series",
            longLivedMainFreeze: false,
        },
    }));

    const cycle = loadCycleForRegeneration(output, {
        candidateHead: "new-head",
        upstreamTip: "upstream-tip",
    });

    assert.equal(cycle.candidateHead, "new-head");
    assert.equal(cycle.upstreamTip, "upstream-tip");
    assert.equal(cycle.mainBranch, "multipleAI");
    assert.deepEqual(cycle.deliveryStrategy, {
        mode: "rolling-verified-series",
        longLivedMainFreeze: false,
    });
});

test("refreshes the mapping endpoint from the current branch without losing cycle policy", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-refresh-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const upstreamBase = commitFile(repo, "base.txt", "base\n", "base");
    git(repo, ["switch", "-c", "upstream"]);
    const upstreamTip = commitFile(repo, "upstream.txt", "upstream\n", "upstream behavior");
    git(repo, ["switch", "-c", "series", upstreamBase]);
    const localBase = commitFile(repo, "local.txt", "local\n", "local base");
    const output = join(repo, "audit");
    writeFileSync(join(repo, "message.txt"), [
        "port upstream behavior",
        "",
        `Upstream-Commit: ${upstreamTip}`,
        "Upstream-Series: fixture/refresh",
        "Upstream-Disposition: semantic-port",
        "Upstream-Audit: audit/commits.jsonl",
    ].join("\n"));
    writeFileSync(join(repo, "port.txt"), "port\n");
    git(repo, ["add", "port.txt"]);
    git(repo, ["commit", "-F", "message.txt"]);
    const candidateHead = git(repo, ["rev-parse", "HEAD"]);
    const records = buildAuditRecords({repo, upstreamBase, upstreamTip, localBase, candidateHead});
    writeAuditManifest({
        repo,
        output,
        cycle: {
            upstreamBase,
            upstreamTip,
            localBase,
            candidateBranch: "stale-branch",
            candidateHead: localBase,
            deliveryStrategy: {mode: "rolling-verified-series"},
        },
        records,
    });

    const refreshed = refreshAuditManifest({repo, output});

    assert.equal(refreshed.candidateBranch, "series");
    assert.equal(refreshed.candidateHead, candidateHead);
    assert.equal(refreshed.mappedUpstreamCommitCount, 1);
    assert.deepEqual(refreshed.deliveryStrategy, {mode: "rolling-verified-series"});
});
