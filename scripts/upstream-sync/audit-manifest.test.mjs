import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {
    advanceAuditTip,
    applyAuditDecisions,
    buildAuditRecords,
    deriveUpstreamCoverage,
    deriveUpstreamReconciliation,
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

test("applies validated behavior decisions without overwriting generated mappings", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-decisions-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const base = commitFile(repo, "base.txt", "base\n", "base");
    const upstreamTip = commitFile(repo, "upstream.txt", "upstream\n", "upstream behavior");
    const output = join(repo, "audit");
    const records = buildAuditRecords({repo, upstreamBase: base, upstreamTip});
    writeAuditManifest({repo, output, cycle: {cycleId: "fixture", upstreamBase: base, upstreamTip}, records});
    const decisionsPath = join(repo, "decisions.json");
    writeFileSync(decisionsPath, JSON.stringify({
        cycleId: "fixture",
        decisions: [{
            sha: upstreamTip,
            status: "verified",
            intent: "Preserve the reviewed upstream behavior.",
            behaviorContract: {
                preconditions: ["The upstream behavior is invoked."],
                stateTransitions: ["The mapped action is performed."],
                outputs: ["The result remains observable."],
                invariants: ["Generated Git mappings remain untouched."],
                failures: ["Invalid decision input stops before writing."],
            },
            disposition: "ported-semantic",
            seriesId: "fixture/behavior",
            codeEvidence: ["src/owner.ts"],
            testEvidence: ["node --test fixture"],
            notes: ["Decision is stored outside generated JSONL."],
        }],
    }, null, 2));

    assert.deepEqual(applyAuditDecisions({repo, output, decisionsPath}), {
        cycleId: "fixture",
        appliedDecisionCount: 1,
    });
    const applied = JSON.parse(readFileSync(join(output, "commits.jsonl"), "utf8"));
    assert.equal(applied.audit.status, "verified");
    assert.equal(applied.audit.disposition, "ported-semantic");
    assert.deepEqual(applied.audit.codeEvidence, ["src/owner.ts"]);
    assert.deepEqual(applied.audit.localCommits, []);
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

test("drops abandoned mappings when an unintegrated candidate is rewritten", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-rewrite-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const upstreamBase = commitFile(repo, "base.txt", "base\n", "base");
    git(repo, ["switch", "-c", "upstream"]);
    const upstreamTip = commitFile(repo, "upstream.txt", "upstream\n", "upstream behavior");
    git(repo, ["switch", "-c", "candidate", upstreamBase]);
    const localBase = commitFile(repo, "local.txt", "local\n", "local base");
    const output = join(repo, "audit");
    const message = [
        "port upstream behavior",
        "",
        `Upstream-Commit: ${upstreamTip}`,
        "Upstream-Series: fixture/rewrite",
        "Upstream-Disposition: semantic-port",
        "Upstream-Audit: audit/commits.jsonl",
    ].join("\n");
    const firstCandidate = commitFile(repo, "first-port.txt", "first\n", message);
    writeAuditManifest({
        repo,
        output,
        cycle: {upstreamBase, upstreamTip, localBase, candidateHead: firstCandidate},
        records: buildAuditRecords({repo, upstreamBase, upstreamTip, localBase, candidateHead: firstCandidate}),
    });

    git(repo, ["reset", "--hard", localBase]);
    const rewrittenCandidate = commitFile(repo, "rewritten-port.txt", "rewritten\n", message);
    const records = buildAuditRecords({
        repo,
        upstreamBase,
        upstreamTip,
        localBase,
        candidateHead: rewrittenCandidate,
        existingManifestPath: join(output, "commits.jsonl"),
    });

    assert.deepEqual(records[0].audit.localCommits, [rewrittenCandidate]);
    assert.deepEqual(records[0].audit.mappingEvidence.map((entry) => entry.localCommit), [rewrittenCandidate]);
});

test("advances an upstream tip without losing completed audits and rejects rewritten history", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-tip-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const base = commitFile(repo, "base.txt", "base\n", "base");
    const firstTip = commitFile(repo, "first.txt", "first\n", "first upstream change");
    const output = join(repo, "audit");
    const firstRecords = buildAuditRecords({repo, upstreamBase: base, upstreamTip: firstTip});
    firstRecords[0].audit.status = "verified";
    firstRecords[0].audit.disposition = "ported-semantic";
    firstRecords[0].stablePatchId = "a".repeat(40);
    writeAuditManifest({
        repo,
        output,
        cycle: {upstreamBase: base, upstreamTip: firstTip, localBase: base},
        records: firstRecords,
    });

    const secondTip = commitFile(repo, "second.txt", "second\n", "second upstream change");
    git(repo, ["switch", "-c", "series", base]);
    const fetchedAt = "2026-07-30T08:56:24+08:00";
    const advanced = advanceAuditTip({repo, output, upstreamTip: secondTip, fetchedAt});
    const records = readFileSync(join(output, "commits.jsonl"), "utf8")
        .trim().split("\n").map((line) => JSON.parse(line));

    assert.equal(advanced.upstreamTip, secondTip);
    assert.equal(advanced.commitCount, 2);
    assert.equal(records[0].audit.status, "verified");
    assert.equal(records[0].audit.disposition, "ported-semantic");
    assert.equal(records[0].stablePatchId, "a".repeat(40));
    assert.equal(records[1].audit.status, "pending");
    assert.equal(advanced.upstreamTipRefresh.latestCheckedAt, fetchedAt);
    assert.deepEqual(advanced.upstreamTipRefresh.history, [{
        from: firstTip,
        to: secondTip,
        fetchedAt,
        addedCommitCount: 1,
        addedMergeCommitCount: 0,
    }]);
    assert.deepEqual(verifyAuditManifest({repo, output}), {
        commitCount: 2,
        mergeCommitCount: 0,
        revertCommitCount: 0,
        mappedUpstreamCommitCount: 0,
    });

    const checkedAt = "2026-07-30T09:11:51+08:00";
    const checked = advanceAuditTip({repo, output, upstreamTip: secondTip, fetchedAt: checkedAt});
    assert.equal(checked.upstreamTipRefresh.latestCheckedAt, checkedAt);
    assert.deepEqual(checked.upstreamTipRefresh.history, advanced.upstreamTipRefresh.history);
    assert.equal(checked.candidateBranch, advanced.candidateBranch);
    assert.equal(checked.candidateHead, advanced.candidateHead);

    git(repo, ["switch", "--orphan", "rewritten"]);
    const rewrittenTip = commitFile(repo, "rewritten.txt", "rewritten\n", "rewritten upstream history");
    assert.throws(
        () => advanceAuditTip({repo, output, upstreamTip: rewrittenTip, fetchedAt}),
        /Refusing non-fast-forward upstream tip change/,
    );
});

test("records an active audit without inventing its final disposition", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-in-progress-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const base = commitFile(repo, "base.txt", "base\n", "base");
    const upstreamTip = commitFile(repo, "upstream.txt", "upstream\n", "upstream behavior");
    const output = join(repo, "audit");
    writeAuditManifest({
        repo,
        output,
        cycle: {cycleId: "fixture", upstreamBase: base, upstreamTip},
        records: buildAuditRecords({repo, upstreamBase: base, upstreamTip}),
    });
    const decisionsPath = join(repo, "decisions.json");
    writeFileSync(decisionsPath, JSON.stringify({
        cycleId: "fixture",
        decisions: [{
            sha: upstreamTip,
            status: "in-progress",
            intent: "Audit the upstream behavior before selecting a final disposition.",
            seriesId: "fixture/behavior",
            notes: ["No final disposition or verification evidence exists yet."],
        }],
    }, null, 2));

    assert.deepEqual(applyAuditDecisions({repo, output, decisionsPath}), {
        cycleId: "fixture",
        appliedDecisionCount: 1,
    });
    const [record] = readFileSync(join(output, "commits.jsonl"), "utf8")
        .trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(record.audit.status, "in-progress");
    assert.equal(record.audit.disposition, null);
    assert.deepEqual(record.audit.codeEvidence, []);
    assert.deepEqual(record.audit.testEvidence, []);
});

test("derives semantic, delivery and topology coverage from verified Git relations", (context) => {
    const repo = mkdtempSync(join(tmpdir(), "sforge-audit-coverage-"));
    context.after(() => rmSync(repo, {recursive: true, force: true}));
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Test Author"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    const upstreamBase = commitFile(repo, "base.txt", "base\n", "base");
    git(repo, ["switch", "-c", "upstream", upstreamBase]);
    const upstreamFirst = commitFile(repo, "upstream-first.txt", "first\n", "upstream first");
    const upstreamTip = commitFile(repo, "upstream-second.txt", "second\n", "upstream second");
    git(repo, ["switch", "main"]);
    const localBase = commitFile(repo, "local.txt", "local\n", "local base");
    git(repo, ["switch", "-c", "series"]);
    const firstPort = [
        "port first", "", `Upstream-Commit: ${upstreamFirst}`,
        "Upstream-Series: fixture/coverage", "Upstream-Disposition: semantic-port",
        "Upstream-Audit: audit/commits.jsonl",
    ].join("\n");
    const secondPort = [
        "port second", "", `Upstream-Commit: ${upstreamTip}`,
        "Upstream-Series: fixture/coverage", "Upstream-Disposition: semantic-port",
        "Upstream-Audit: audit/commits.jsonl",
    ].join("\n");
    commitFile(repo, "port-first.txt", "first\n", firstPort);
    const seriesHead = commitFile(repo, "port-second.txt", "second\n", secondPort);
    git(repo, ["switch", "main"]);
    git(repo, ["merge", "--no-ff", "series", "-m", "deliver semantic ports"]);
    const delivery = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["merge", "--no-ff", "-s", "ours", "upstream", "-m", "record verified upstream topology"]);
    const topologyCheckpoint = git(repo, ["rev-parse", "HEAD"]);
    const output = join(repo, "audit");
    const records = buildAuditRecords({
        repo, upstreamBase, upstreamTip, localBase, candidateHead: topologyCheckpoint,
    });
    for (const record of records) {
        record.audit.status = "verified";
        record.audit.disposition = "ported-semantic";
        record.audit.intent = "Preserve the verified upstream behavior.";
        record.audit.behaviorContract.outputs = ["The behavior remains observable."];
        record.audit.codeEvidence = ["src/owner.ts"];
        record.audit.testEvidence = ["node --test fixture"];
    }
    writeAuditManifest({repo, output, cycle: {upstreamBase, upstreamTip, localBase, mainBranch: "main"}, records});
    writeFileSync(join(output, "deliveries.jsonl"), `${JSON.stringify({
        deliveryId: "D1", status: "integrated", upstreamCommits: [upstreamFirst, upstreamTip],
        mainBase: localBase, seriesHead, integrationCommit: delivery,
    })}\n`);
    const deliveryOnlyReconciliation = deriveUpstreamReconciliation({repo, output});
    assert.equal(deliveryOnlyReconciliation.entries[0].state, "delivery-integrated");
    assert.equal(deliveryOnlyReconciliation.entries[0].nextAction, "create-topology-checkpoint");
    assert.equal(deliveryOnlyReconciliation.summary.firstActionable.sha, upstreamFirst);
    writeFileSync(join(output, "topology-checkpoints.jsonl"), `${JSON.stringify({
        checkpointId: "C1", status: "integrated", upstreamBase, upstreamTip,
        mainBase: delivery, integrationCommit: topologyCheckpoint,
    })}\n`);
    const coverage = deriveUpstreamCoverage({repo, output});
    assert.equal(coverage.semanticVerified.count, 2);
    assert.equal(coverage.deliveryIntegrated.count, 2);
    assert.equal(coverage.topologyCovered.count, 2);
    assert.equal(coverage.topologyLag.count, 0);
    assert.equal(coverage.pending.count, 0);

    const reconciliation = deriveUpstreamReconciliation({repo, output});
    assert.deepEqual(reconciliation.summary.stateCounts, {
        "topology-integrated": 2,
        "delivery-integrated": 0,
        "delivery-git-integrated": 0,
        "delivery-in-progress": 0,
        "semantic-verified": 0,
        "audit-in-progress": 0,
        "audit-blocked": 0,
        "audit-pending": 0,
    });
    assert.equal(reconciliation.summary.topologyIntegratedPrefix.count, 2);
    assert.equal(reconciliation.summary.topologyIntegratedPrefix.blocker, null);
    assert.equal(reconciliation.entries[0].state, "topology-integrated");
    assert.deepEqual(reconciliation.entries[0].deliveries, [{
        deliveryId: "D1",
        status: "integrated",
        integrationCommit: delivery,
        runtimeGateStatus: null,
    }]);

    writeFileSync(join(output, "deliveries.jsonl"), `${[
        {
            deliveryId: "D1", status: "integrated", upstreamCommits: [upstreamFirst, upstreamTip],
            mainBase: localBase, seriesHead, integrationCommit: delivery,
        },
        {
            deliveryId: "D2", status: "prepared", upstreamCommits: [upstreamFirst],
        },
    ].map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    assert.throws(
        () => deriveUpstreamReconciliation({repo, output}),
        new RegExp(`${upstreamFirst} is claimed by both active deliveries D1 and D2`),
    );
});
