// Read-only status report for an upstream semantic sync cycle.
// Usage:
//   node scripts/upstream-sync/cycle-status.mjs --repo <main-repo> --output <cycle-dir>
//
// It never writes any file and never mutates the repository. It recomputes
// reachability and topology lag from the live Git graph and combines them with
// the persisted cycle artifacts (cycle.json / reconciliation.json /
// deliveries.jsonl / topology-checkpoints.jsonl).
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {parseArgs} from "node:util";

const MAX_BUFFER = 128 * 1024 * 1024;

const runGit = (repo, args) => execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
});

const loadJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const loadJsonl = (path) =>
    readFileSync(path, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));

const isAncestor = (repo, ancestor, descendant) => {
    try {
        runGit(repo, ["merge-base", "--is-ancestor", ancestor, descendant]);
        return true;
    } catch {
        return false;
    }
};

const revParse = (repo, rev) => {
    try {
        return runGit(repo, ["rev-parse", `${rev}^{commit}`]).trim();
    } catch {
        return null;
    }
};

const requireOption = (values, name) => {
    if (!values[name]) {
        throw new Error(`Missing --${name}`);
    }
    return values[name];
};

const main = () => {
    const {values} = parseArgs({
        options: {
            repo: {type: "string", default: "."},
            output: {type: "string"},
            "pending-preview": {type: "string", default: "15"},
        },
    });
    const repo = resolve(values.repo);
    const output = resolve(requireOption(values, "output"));
    const pendingPreview = Number(requireOption(values, "pending-preview"));

    const cyclePath = resolve(output, "cycle.json");
    const reconciliationPath = resolve(output, "reconciliation.json");
    const deliveriesPath = resolve(output, "deliveries.jsonl");
    const checkpointsPath = resolve(output, "topology-checkpoints.jsonl");
    for (const path of [cyclePath, reconciliationPath, deliveriesPath, checkpointsPath]) {
        if (!existsSync(path)) {
            throw new Error(`Missing artifact: ${path}`);
        }
    }

    const cycle = loadJson(cyclePath);
    const reconciliation = loadJson(reconciliationPath);
    const deliveries = loadJsonl(deliveriesPath);
    const checkpoints = loadJsonl(checkpointsPath);

    const head = revParse(repo, "HEAD");
    const sourceHead = reconciliation.sourceHead;
    const ledgerFresh = head !== null && sourceHead === head;

    // topologyLag is recomputed against the live graph, not trusted from files.
    let topologyLag = null;
    try {
        topologyLag = Number(runGit(repo, ["rev-list", "--count", `${head}..${cycle.upstreamTip}`]).trim());
    } catch {
        topologyLag = null; // U1 object not present in the main repository.
    }

    // Reachability of every persisted delivery and topology checkpoint.
    const deliveryReachability = deliveries.map((d) => ({
        deliveryId: d.deliveryId,
        status: d.status,
        integrationCommit: d.integrationCommit,
        reachable: head !== null && isAncestor(repo, d.integrationCommit, head),
        localSemanticCommits: d.localSemanticCommits.length,
        upstreamCommits: d.upstreamCommits.length,
        integratedAt: d.integratedAt ?? d.gitIntegratedAt ?? null,
    }));
    const checkpointReachability = checkpoints.map((c) => ({
        checkpointId: c.checkpointId,
        status: c.status,
        upstreamBase: c.upstreamBase,
        upstreamTip: c.upstreamTip,
        integrationCommit: c.integrationCommit,
        reachable: head !== null && isAncestor(repo, c.integrationCommit, head),
        treeMatchesMainBase: c.treeMatchesMainBase,
    }));

    // Per-entry views over the reconciliation ledger.
    const entries = reconciliation.entries;
    const pending = entries.filter((e) => e.state === "audit-pending");
    const actionable = entries.filter((e) => e.nextAction !== "none" && e.state !== "audit-pending");
    const closed = entries.filter((e) => e.state !== "audit-pending");

    const report = {
        cycle: {
            cycleId: cycle.cycleId,
            mainBranch: cycle.mainBranch,
            localBase: cycle.localBase,
            upstreamBase: cycle.upstreamBase,
            upstreamTip: cycle.upstreamTip,
            upstreamTipFetchedAt: cycle.upstreamTipFetchedAt,
            commitCount: cycle.commitCount,
            mergeCommitCount: cycle.mergeCommitCount,
            mappedUpstreamCommitCount: cycle.mappedUpstreamCommitCount,
            latestDelivery: cycle.latestDelivery,
            latestIntegratedHead: cycle.latestIntegratedHead,
            isolatedRepository: cycle.isolatedRepository,
            isolatedRepositoryExists: existsSync(cycle.isolatedRepository),
        },
        git: {
            head,
            sourceHead,
            ledgerFresh,
            topologyLag,
            worktreeDirty: runGit(repo, ["status", "--porcelain"]).trim() !== "",
        },
        ledger: {
            total: reconciliation.summary.total,
            stateCounts: reconciliation.summary.stateCounts,
            semanticVerifiedPrefix: reconciliation.summary.semanticVerifiedPrefix,
            deliveryIntegratedPrefix: reconciliation.summary.deliveryIntegratedPrefix,
            topologyIntegratedPrefix: reconciliation.summary.topologyIntegratedPrefix,
            firstActionable: reconciliation.summary.firstActionable,
        },
        deliveries: deliveryReachability,
        checkpoints: checkpointReachability,
        backlog: {
            pendingCount: pending.length,
            closedCount: closed.length,
            actionableCount: actionable.length,
            pendingNextActionCounts: Object.fromEntries(
                [...new Set(entries.map((e) => e.nextAction))].map((action) => [
                    action,
                    entries.filter((e) => e.nextAction === action).length,
                ]),
            ),
            pendingPreview: pending.slice(0, pendingPreview).map((e) => ({
                topoIndex: e.topoIndex,
                sha: e.sha,
                subject: e.subject,
                nextAction: e.nextAction,
            })),
            actionablePreview: actionable.map((e) => ({
                topoIndex: e.topoIndex,
                sha: e.sha,
                subject: e.subject,
                state: e.state,
                nextAction: e.nextAction,
                seriesId: e.audit?.seriesId ?? null,
            })),
        },
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main();
}
