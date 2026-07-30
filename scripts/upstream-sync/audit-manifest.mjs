import {execFileSync} from "node:child_process";
import {
    closeSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readFileSync,
    rmdirSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {parseArgs} from "node:util";

const MAX_BUFFER = 128 * 1024 * 1024;

const runGit = (repo, args, options = {}) => execFileSync("git", args, {
    cwd: repo,
    encoding: options.encoding ?? "utf8",
    input: options.input,
    maxBuffer: MAX_BUFFER,
    stdio: options.input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
});

const parseMetadataLog = (output) => {
    const records = new Map();
    for (const segment of output.split("\x1e").slice(1)) {
        const [sha, parents, authorName, authorEmail, authoredAt, subject, body] =
            segment.replace(/^\r?\n/, "").split("\0");
        if (!sha || subject === undefined) {
            throw new Error("Malformed git metadata record");
        }
        records.set(sha, {
            sha,
            parents: parents ? parents.split(" ") : [],
            author: {name: authorName, email: authorEmail},
            authoredAt,
            subject,
            body: body ?? "",
        });
    }
    return records;
};

const readTrailer = (body, name) => {
    const match = new RegExp(`^${name}:\\s*(.+?)\\s*$`, "imu").exec(body);
    return match?.[1] ?? null;
};

const readLocalMappings = (repo, localBase, candidateHead) => {
    const mappings = new Map();
    if (!localBase || !candidateHead || localBase === candidateHead) {
        return mappings;
    }
    runGit(repo, ["merge-base", "--is-ancestor", localBase, candidateHead]);
    const output = runGit(repo, [
        "log", "--format=%x1e%H%x00%B", candidateHead, `^${localBase}`,
    ]);
    for (const segment of output.split("\x1e").slice(1)) {
        const [localCommit, body = ""] = segment.replace(/^\r?\n/, "").split("\0");
        const upstreamCommits = [...body.matchAll(/^Upstream-Commit:\s*([0-9a-f]{40})\s*$/gimu)];
        for (const match of upstreamCommits) {
            const upstreamCommit = match[1].toLowerCase();
            const entries = mappings.get(upstreamCommit) ?? [];
            entries.push({
                localCommit,
                declaredDisposition: readTrailer(body, "Upstream-Disposition"),
                series: readTrailer(body, "Upstream-Series"),
                audit: readTrailer(body, "Upstream-Audit"),
                patchId: readTrailer(body, "Upstream-Patch-ID"),
            });
            mappings.set(upstreamCommit, entries);
        }
    }
    for (const entries of mappings.values()) {
        entries.sort((left, right) => left.localCommit.localeCompare(right.localCommit, "en"));
    }
    return mappings;
};

const readExistingRecords = (manifestPath) => {
    if (!existsSync(manifestPath)) {
        return new Map();
    }
    const records = new Map();
    for (const line of readFileSync(manifestPath, "utf8").split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const record = JSON.parse(line);
        if (record.sha && record.audit) {
            records.set(record.sha, record);
        }
    }
    return records;
};

const readJSONLines = (path, label) => {
    if (!existsSync(path)) {
        return [];
    }
    return readFileSync(path, "utf8").split(/\r?\n/u)
        .filter((line) => line.trim())
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(`Invalid ${label} JSON at line ${index + 1}: ${error.message}`);
            }
        });
};

const isAncestor = (repo, ancestor, descendant) => {
    try {
        runGit(repo, ["merge-base", "--is-ancestor", ancestor, descendant]);
        return true;
    } catch {
        return false;
    }
};

const getCommitParents = (repo, sha) => runGit(repo, ["show", "-s", "--format=%P", sha])
    .trim().split(/\s+/u).filter(Boolean);

const getTree = (repo, sha) => runGit(repo, ["rev-parse", `${sha}^{tree}`]).trim();

const resolveCommit = (repo, sha, label) => {
    if (typeof sha !== "string" || !/^[0-9a-f]{40}$/u.test(sha)) {
        throw new Error(`${label} must be a full commit SHA`);
    }
    return runGit(repo, ["rev-parse", "--verify", `${sha}^{commit}`]).trim();
};

const isVerifiedAudit = (record) => record.audit.status === "verified";

const auditStatuses = new Set([
    "pending",
    "in-progress",
    "blocked",
    "verified",
    "reopened",
]);

const deliveryStatuses = new Set([
    "prepared",
    "verified",
    "git-integrated",
    "integrated",
    "failed",
    "reverted",
]);

const activeDeliveryStatuses = new Set([
    "prepared",
    "verified",
    "git-integrated",
    "integrated",
]);

const reconciliationStates = [
    "topology-integrated",
    "delivery-integrated",
    "delivery-git-integrated",
    "delivery-in-progress",
    "semantic-verified",
    "audit-in-progress",
    "audit-blocked",
    "audit-pending",
];

const validateAuditStatus = (record) => {
    if (!record.audit || !auditStatuses.has(record.audit.status)) {
        throw new Error(`Unsupported audit status for ${record.sha}: ${record.audit?.status ?? "<missing>"}`);
    }
};

const appendMapValue = (map, key, value) => {
    const entries = map.get(key) ?? [];
    entries.push(value);
    map.set(key, entries);
};

const deriveContinuousPrefix = (records, predicate) => {
    const firstUncovered = records.find((record) => !predicate(record)) ?? null;
    const coveredCount = firstUncovered === null ? records.length : firstUncovered.topoIndex - 1;
    return {
        count: coveredCount,
        through: coveredCount === 0 ? null : records[coveredCount - 1].sha,
        blocker: firstUncovered === null ? null : {
            topoIndex: firstUncovered.topoIndex,
            sha: firstUncovered.sha,
            subject: firstUncovered.subject,
        },
    };
};

/**
 * Reconciles every upstream SHA against its audit decision, rolling delivery
 * and real topology checkpoint. This is a derived ledger: its inputs remain
 * commits.jsonl, deliveries.jsonl, topology-checkpoints.jsonl and Git.
 */
export const deriveUpstreamReconciliation = ({repo, output, mainHead}) => {
    const cycle = JSON.parse(readFileSync(resolve(output, "cycle.json"), "utf8"));
    const records = readJSONLines(resolve(output, "commits.jsonl"), "commits manifest");
    const recordsBySha = new Map(records.map((record) => [record.sha, record]));
    const resolvedMainHead = mainHead ? resolveCommit(repo, mainHead, "mainHead") :
        runGit(repo, ["rev-parse", "HEAD"]).trim();

    for (const record of records) {
        validateAuditStatus(record);
    }

    const deliveries = readJSONLines(resolve(output, "deliveries.jsonl"), "delivery manifest");
    const integratedDeliveryIDs = [];
    const deliveriesByUpstreamSHA = new Map();
    const activeDeliveryByUpstreamSHA = new Map();

    for (const delivery of deliveries) {
        if (typeof delivery.deliveryId !== "string" || delivery.deliveryId.length === 0) {
            throw new Error("A delivery is missing deliveryId");
        }
        if (!deliveryStatuses.has(delivery.status)) {
            throw new Error(`Unsupported delivery status for ${delivery.deliveryId}: ${delivery.status ?? "<missing>"}`);
        }
        if (!Array.isArray(delivery.upstreamCommits) || delivery.upstreamCommits.length === 0) {
            throw new Error(`${delivery.deliveryId} must identify its upstream commits`);
        }

        for (const upstreamSHA of delivery.upstreamCommits) {
            const record = recordsBySha.get(upstreamSHA);
            if (!record) {
                throw new Error(`${delivery.deliveryId} references upstream SHA outside commits.jsonl: ${upstreamSHA}`);
            }
            if (activeDeliveryStatuses.has(delivery.status)) {
                if (!isVerifiedAudit(record)) {
                    throw new Error(`${delivery.deliveryId} claims an upstream SHA without verified semantic evidence: ${upstreamSHA}`);
                }
                const owner = activeDeliveryByUpstreamSHA.get(upstreamSHA);
                if (owner) {
                    throw new Error(`${upstreamSHA} is claimed by both active deliveries ${owner.deliveryId} and ${delivery.deliveryId}`);
                }
                activeDeliveryByUpstreamSHA.set(upstreamSHA, delivery);
            }
            appendMapValue(deliveriesByUpstreamSHA, upstreamSHA, delivery);
        }

        if (delivery.status !== "git-integrated" && delivery.status !== "integrated") {
            continue;
        }
        const integrationCommit = resolveCommit(repo, delivery.integrationCommit, `${delivery.deliveryId}.integrationCommit`);
        const mainBase = resolveCommit(repo, delivery.mainBase, `${delivery.deliveryId}.mainBase`);
        const seriesHead = resolveCommit(repo, delivery.seriesHead, `${delivery.deliveryId}.seriesHead`);
        const parents = getCommitParents(repo, integrationCommit);
        if (parents.length !== 2 || parents[0] !== mainBase || parents[1] !== seriesHead) {
            throw new Error(`${delivery.deliveryId} does not retain the recorded D_i parent relation`);
        }
        if (!isAncestor(repo, integrationCommit, resolvedMainHead)) {
            throw new Error(`${delivery.deliveryId} is not reachable from the inspected main head`);
        }
        if (delivery.status === "integrated") {
            integratedDeliveryIDs.push(delivery.deliveryId);
        }
    }

    const checkpoints = readJSONLines(resolve(output, "topology-checkpoints.jsonl"), "topology checkpoint manifest");
    const topologyByUpstreamSHA = new Map();
    const checkpointIDs = [];
    let expectedUpstreamBase = cycle.upstreamBase;
    for (const checkpoint of checkpoints) {
        if (checkpoint.status !== "integrated") {
            throw new Error(`Topology checkpoint ${checkpoint.checkpointId ?? "<unnamed>"} is not integrated`);
        }
        if (typeof checkpoint.checkpointId !== "string" || checkpoint.checkpointId.length === 0) {
            throw new Error("An integrated topology checkpoint is missing checkpointId");
        }
        const upstreamBase = resolveCommit(repo, checkpoint.upstreamBase, `${checkpoint.checkpointId}.upstreamBase`);
        const upstreamTip = resolveCommit(repo, checkpoint.upstreamTip, `${checkpoint.checkpointId}.upstreamTip`);
        const mainBase = resolveCommit(repo, checkpoint.mainBase, `${checkpoint.checkpointId}.mainBase`);
        const integrationCommit = resolveCommit(repo, checkpoint.integrationCommit, `${checkpoint.checkpointId}.integrationCommit`);
        if (upstreamBase !== expectedUpstreamBase || !isAncestor(repo, upstreamBase, upstreamTip)) {
            throw new Error(`${checkpoint.checkpointId} does not extend the previous continuous upstream boundary`);
        }
        if (!isAncestor(repo, upstreamTip, cycle.upstreamTip)) {
            throw new Error(`${checkpoint.checkpointId} references an upstream tip outside the frozen audit range`);
        }
        const parents = getCommitParents(repo, integrationCommit);
        if (parents.length !== 2 || parents[0] !== mainBase || parents[1] !== upstreamTip) {
            throw new Error(`${checkpoint.checkpointId} does not retain the recorded topology merge parents`);
        }
        if (getTree(repo, integrationCommit) !== getTree(repo, mainBase)) {
            throw new Error(`${checkpoint.checkpointId} changed the local semantic tree during topology closure`);
        }
        if (!isAncestor(repo, integrationCommit, resolvedMainHead)) {
            throw new Error(`${checkpoint.checkpointId} is not reachable from the inspected main head`);
        }
        const checkpointSHAs = runGit(repo, [
            "rev-list", "--reverse", "--topo-order", upstreamTip, `^${upstreamBase}`,
        ]).trim().split(/\r?\n/u).filter(Boolean);
        for (const upstreamSHA of checkpointSHAs) {
            const record = recordsBySha.get(upstreamSHA);
            const delivery = activeDeliveryByUpstreamSHA.get(upstreamSHA);
            if (!record || !isVerifiedAudit(record) || delivery?.status !== "integrated") {
                throw new Error(`${checkpoint.checkpointId} covers an upstream SHA without verified integrated semantics: ${upstreamSHA}`);
            }
            appendMapValue(topologyByUpstreamSHA, upstreamSHA, checkpoint);
        }
        checkpointIDs.push(checkpoint.checkpointId);
        expectedUpstreamBase = upstreamTip;
    }

    const summarizeDelivery = (delivery) => ({
        deliveryId: delivery.deliveryId,
        status: delivery.status,
        integrationCommit: delivery.integrationCommit ?? null,
        runtimeGateStatus: delivery.runtimeGate?.status ?? null,
    });
    const summarizeCheckpoint = (checkpoint) => ({
        checkpointId: checkpoint.checkpointId,
        integrationCommit: checkpoint.integrationCommit,
    });
    const deriveState = (record) => {
        const activeDelivery = activeDeliveryByUpstreamSHA.get(record.sha);
        if (topologyByUpstreamSHA.has(record.sha)) {
            return "topology-integrated";
        }
        if (activeDelivery?.status === "integrated") {
            return "delivery-integrated";
        }
        if (activeDelivery?.status === "git-integrated") {
            return "delivery-git-integrated";
        }
        if (activeDelivery) {
            return "delivery-in-progress";
        }
        if (record.audit.status === "verified") {
            return "semantic-verified";
        }
        if (record.audit.status === "in-progress" || record.audit.status === "reopened") {
            return "audit-in-progress";
        }
        if (record.audit.status === "blocked") {
            return "audit-blocked";
        }
        return "audit-pending";
    };
    const deriveNextAction = (record, state) => {
        switch (state) {
            case "topology-integrated": return "none";
            case "delivery-integrated": return "await-continuous-topology-prefix";
            case "delivery-git-integrated": return "complete-runtime-gate";
            case "delivery-in-progress": return "complete-delivery-verification";
            case "semantic-verified": return "create-rolling-delivery";
            case "audit-in-progress": return "complete-audit";
            case "audit-blocked": return "resolve-audit-blocker";
            default: return "audit-upstream-behavior";
        }
    };
    const entries = records.map((record) => {
        const state = deriveState(record);
        return {
            topoIndex: record.topoIndex,
            sha: record.sha,
            subject: record.subject,
            state,
            nextAction: deriveNextAction(record, state),
            audit: {
                status: record.audit.status,
                disposition: record.audit.disposition,
                seriesId: record.audit.seriesId,
                localCommits: record.audit.localCommits,
                mappingEvidence: record.audit.mappingEvidence,
                codeEvidence: record.audit.codeEvidence,
                testEvidence: record.audit.testEvidence,
            },
            deliveries: (deliveriesByUpstreamSHA.get(record.sha) ?? []).map(summarizeDelivery),
            topologyCheckpoints: (topologyByUpstreamSHA.get(record.sha) ?? []).map(summarizeCheckpoint),
        };
    });
    const entriesBySHA = new Map(entries.map((entry) => [entry.sha, entry]));
    const hasState = (state) => (record) => entriesBySHA.get(record.sha).state === state;
    const topologyLagSHAs = runGit(repo, [
        "rev-list", "--reverse", "--topo-order", cycle.upstreamTip, `^${resolvedMainHead}`,
    ]).trim().split(/\r?\n/u).filter(Boolean);
    const stateCounts = Object.fromEntries(reconciliationStates.map((state) => [
        state,
        entries.filter((entry) => entry.state === state).length,
    ]));
    const byState = (state) => entries.filter((entry) => entry.state === state).map((entry) => entry.sha);
    return {
        schemaVersion: 1,
        sourceHead: resolvedMainHead,
        upstreamBase: cycle.upstreamBase,
        upstreamTip: cycle.upstreamTip,
        summary: {
            total: entries.length,
            stateCounts,
            semanticVerifiedPrefix: deriveContinuousPrefix(records, isVerifiedAudit),
            deliveryIntegratedPrefix: deriveContinuousPrefix(records, (record) =>
                hasState("delivery-integrated")(record) || hasState("topology-integrated")(record)),
            topologyIntegratedPrefix: deriveContinuousPrefix(records, hasState("topology-integrated")),
            firstActionable: entries.find((entry) => entry.nextAction !== "none") ?? null,
        },
        coverage: {
            semanticVerified: records.filter(isVerifiedAudit).map((record) => record.sha),
            deliveryIntegrated: byState("delivery-integrated").concat(byState("topology-integrated")),
            topologyCovered: byState("topology-integrated"),
            pending: entries.filter((entry) => !isVerifiedAudit(recordsBySha.get(entry.sha))).map((entry) => entry.sha),
            topologyLag: topologyLagSHAs,
            deliveryIds: integratedDeliveryIDs,
            checkpointIds: checkpointIDs,
            topologyThrough: checkpointIDs.length > 0 ? expectedUpstreamBase : null,
        },
        entries,
    };
};

/**
 * Derives mutually exclusive audit, delivery and topology coverage from Git
 * objects and versioned manifests. No count is inferred from branch names.
 */
export const deriveUpstreamCoverage = ({repo, output, mainHead}) => {
    const reconciliation = deriveUpstreamReconciliation({repo, output, mainHead});
    return coverageFromReconciliation(reconciliation);
};

const coverageFromReconciliation = (reconciliation) => {
    return {
        schemaVersion: 2,
        sourceHead: reconciliation.sourceHead,
        upstreamBase: reconciliation.upstreamBase,
        upstreamTip: reconciliation.upstreamTip,
        semanticVerified: {
            count: reconciliation.coverage.semanticVerified.length,
            shas: reconciliation.coverage.semanticVerified,
        },
        deliveryIntegrated: {
            count: reconciliation.coverage.deliveryIntegrated.length,
            deliveryIds: reconciliation.coverage.deliveryIds,
            shas: reconciliation.coverage.deliveryIntegrated,
        },
        topologyCovered: {
            count: reconciliation.coverage.topologyCovered.length,
            checkpointIds: reconciliation.coverage.checkpointIds,
            through: reconciliation.coverage.topologyThrough,
            shas: reconciliation.coverage.topologyCovered,
        },
        pending: {
            count: reconciliation.coverage.pending.length,
            shas: reconciliation.coverage.pending,
        },
        topologyLag: {
            count: reconciliation.coverage.topologyLag.length,
            shas: reconciliation.coverage.topologyLag,
        },
        reconciliation: reconciliation.summary,
    };
};

export const writeUpstreamCoverage = ({repo, output, mainHead}) => {
    const reconciliation = deriveUpstreamReconciliation({repo, output, mainHead});
    const coverage = coverageFromReconciliation(reconciliation);
    writeFileSync(resolve(output, "coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
    writeFileSync(resolve(output, "reconciliation.json"), `${JSON.stringify(reconciliation, null, 2)}\n`);
    return coverage;
};

const emptyAudit = () => ({
    status: "pending",
    intent: null,
    behaviorContract: {
        preconditions: [],
        stateTransitions: [],
        outputs: [],
        invariants: [],
        failures: [],
    },
    relationships: {
        dependsOn: [],
        reverts: [],
        revertedBy: [],
        supersedes: [],
        supersededBy: [],
    },
    disposition: null,
    seriesId: null,
    localCommits: [],
    mappingEvidence: [],
    codeEvidence: [],
    testEvidence: [],
    humanReview: null,
    notes: [],
});

const getChangedPaths = (repo, sha) => {
    const output = runGit(repo, [
        "-c", "core.quotePath=false", "diff-tree", "--root", "--no-commit-id",
        "--name-only", "-r", "-m", "--no-renames", "-z", sha,
    ]);
    return [...new Set(output.split("\0").filter(Boolean))].sort();
};

const getStablePatchId = (repo, sha, isMerge) => {
    if (isMerge) {
        return null;
    }
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "sforge-upstream-patch-id-"));
    const patchPath = join(temporaryDirectory, "patch");
    try {
        const patchOutput = openSync(patchPath, "w");
        try {
            execFileSync("git", [
                "show", "--pretty=format:", "--no-ext-diff", "--no-textconv",
                "--no-renames", "--full-index", "--binary", sha,
            ], {
                cwd: repo,
                maxBuffer: MAX_BUFFER,
                stdio: ["ignore", patchOutput, "pipe"],
            });
        } finally {
            closeSync(patchOutput);
        }
        if (statSync(patchPath).size === 0) {
            return null;
        }
        const patchInput = openSync(patchPath, "r");
        try {
            const output = execFileSync("git", ["patch-id", "--stable"], {
                cwd: repo,
                encoding: "utf8",
                maxBuffer: MAX_BUFFER,
                stdio: [patchInput, "pipe", "pipe"],
            }).trim();
            return output ? output.split(/\s+/, 1)[0] : null;
        } finally {
            closeSync(patchInput);
        }
    } finally {
        if (existsSync(patchPath)) {
            unlinkSync(patchPath);
        }
        rmdirSync(temporaryDirectory);
    }
};

const getRevertTargets = (repo, body) => {
    const targets = new Set();
    for (const match of body.matchAll(/^This reverts commit ([0-9a-f]{7,40})\.?\s*$/gimu)) {
        try {
            targets.add(runGit(repo, ["rev-parse", "--verify", `${match[1]}^{commit}`]).trim());
        } catch {
            targets.add(match[1].toLowerCase());
        }
    }
    return [...targets].sort();
};

const mergeAuditMapping = (audit, mappings, revertTargets) => ({
    ...audit,
    relationships: {
        ...emptyAudit().relationships,
        ...audit.relationships,
        reverts: [...new Set([...(audit.relationships?.reverts ?? []), ...revertTargets])].sort(),
    },
    localCommits: [...new Set([
        ...(audit.localCommits ?? []),
        ...mappings.map((mapping) => mapping.localCommit),
    ])].sort(),
    mappingEvidence: mappings,
});

export const buildAuditRecords = ({
    repo,
    upstreamBase,
    upstreamTip,
    localBase,
    candidateHead,
    existingManifestPath,
}) => {
    runGit(repo, ["merge-base", "--is-ancestor", upstreamBase, upstreamTip]);
    const shas = runGit(repo, [
        "rev-list", "--reverse", "--topo-order", upstreamTip, `^${upstreamBase}`,
    ]).trim().split(/\r?\n/).filter(Boolean);
    const metadata = parseMetadataLog(runGit(repo, [
        "log", "--format=%x1e%H%x00%P%x00%an%x00%ae%x00%aI%x00%s%x00%B", upstreamTip, `^${upstreamBase}`,
    ]));
    const existingRecords = readExistingRecords(existingManifestPath);
    const localMappings = readLocalMappings(repo, localBase, candidateHead);

    const records = shas.map((sha, index) => {
        const item = metadata.get(sha);
        if (!item) {
            throw new Error(`Missing metadata for ${sha}`);
        }
        const isMerge = item.parents.length > 1;
        const revertTargets = getRevertTargets(repo, item.body);
        const isRevert = !isMerge && (revertTargets.length > 0 || /^Revert\b/u.test(item.subject));
        const existingRecord = existingRecords.get(sha);
        const audit = mergeAuditMapping(
            existingRecord?.audit ?? emptyAudit(),
            localMappings.get(sha) ?? [],
            revertTargets,
        );
        const {body: _body, ...publicItem} = item;
        return {
            ...publicItem,
            topoIndex: index + 1,
            commitType: isMerge ? "merge" : (isRevert ? "revert" : "commit"),
            paths: getChangedPaths(repo, sha),
            // A stable patch ID is derived solely from this immutable commit.
            // Retaining the recorded value avoids recomputing the whole frozen
            // range when a newer upstream tip only adds entries.
            stablePatchId: Object.hasOwn(existingRecord ?? {}, "stablePatchId") ?
                existingRecord.stablePatchId : getStablePatchId(repo, sha, isMerge),
            audit,
        };
    });
    const recordsBySha = new Map(records.map((record) => [record.sha, record]));
    for (const record of records) {
        for (const revertedSha of record.audit.relationships.reverts) {
            const revertedRecord = recordsBySha.get(revertedSha);
            if (revertedRecord) {
                revertedRecord.audit.relationships.revertedBy = [...new Set([
                    ...revertedRecord.audit.relationships.revertedBy,
                    record.sha,
                ])].sort();
            }
        }
    }
    return records;
};

export const writeAuditManifest = ({repo, output, cycle, records}) => {
    mkdirSync(output, {recursive: true});
    const manifestPath = resolve(output, "commits.jsonl");
    const mergeCommitCount = records.filter((record) => record.commitType === "merge").length;
    const revertCommitCount = records.filter((record) => record.commitType === "revert").length;
    const stablePatchIdCount = records.filter((record) => record.stablePatchId !== null).length;
    const mappedUpstreamCommitCount = records.filter((record) => record.audit.localCommits.length > 0).length;
    const cycleRecord = {
        ...cycle,
        schemaVersion: 1,
        generator: "scripts/upstream-sync/audit-manifest.mjs",
        commitCount: records.length,
        mergeCommitCount,
        revertCommitCount,
        stablePatchIdCount,
        mappedUpstreamCommitCount,
        auditGrouping: {
            mode: "optional",
            fixedSize: null,
            note: "Grouping is an execution aid and never a completion boundary.",
        },
    };
    writeFileSync(resolve(output, "cycle.json"), `${JSON.stringify(cycleRecord, null, 2)}\n`);
    writeFileSync(manifestPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
    return cycleRecord;
};

export const loadCycleForRegeneration = (output, generatedCycle) => {
    const cyclePath = resolve(output, "cycle.json");
    if (!existsSync(cyclePath)) {
        return generatedCycle;
    }
    const existingCycle = JSON.parse(readFileSync(cyclePath, "utf8"));
    return {
        ...existingCycle,
        ...generatedCycle,
    };
};

export const verifyAuditManifest = ({repo, output}) => {
    const cycle = JSON.parse(readFileSync(resolve(output, "cycle.json"), "utf8"));
    const records = readFileSync(resolve(output, "commits.jsonl"), "utf8")
        .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const expected = runGit(repo, [
        "rev-list", "--reverse", "--topo-order", cycle.upstreamTip, `^${cycle.upstreamBase}`,
    ]).trim().split(/\r?\n/).filter(Boolean);
    const actual = records.map((record) => record.sha);
    if (new Set(actual).size !== actual.length) {
        throw new Error("commits.jsonl contains duplicate SHA values");
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error("commits.jsonl does not match the frozen DAG order");
    }
    records.forEach((record, index) => {
        if (record.topoIndex !== index + 1) {
            throw new Error(`Invalid topoIndex for ${record.sha}`);
        }
        if (!record.audit || typeof record.audit.status !== "string") {
            throw new Error(`Missing audit state for ${record.sha}`);
        }
    });
    const mergeCommitCount = records.filter((record) => record.commitType === "merge").length;
    const revertCommitCount = records.filter((record) => record.commitType === "revert").length;
    const stablePatchIdCount = records.filter((record) => record.stablePatchId !== null).length;
    const mappedUpstreamCommitCount = records.filter((record) => record.audit.localCommits.length > 0).length;
    if (cycle.commitCount !== records.length ||
        cycle.mergeCommitCount !== mergeCommitCount ||
        cycle.revertCommitCount !== revertCommitCount ||
        cycle.stablePatchIdCount !== stablePatchIdCount ||
        cycle.mappedUpstreamCommitCount !== mappedUpstreamCommitCount) {
        throw new Error("cycle.json counts do not match commits.jsonl");
    }
    deriveUpstreamCoverage({repo, output});
    return {commitCount: records.length, mergeCommitCount, revertCommitCount, mappedUpstreamCommitCount};
};

const auditDecisionContractKeys = ["preconditions", "stateTransitions", "outputs", "invariants", "failures"];

const validateStringList = (value, field, sha) => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
        throw new Error(`Invalid ${field} for ${sha}`);
    }
};

const validateAuditDecision = (decision) => {
    if (!decision || typeof decision !== "object" || !/^[0-9a-f]{40}$/u.test(decision.sha ?? "")) {
        throw new Error("Audit decision must declare a full upstream SHA");
    }
    for (const field of ["status", "intent", "disposition", "seriesId"]) {
        if (typeof decision[field] !== "string" || decision[field].length === 0) {
            throw new Error(`Audit decision ${decision.sha} has no ${field}`);
        }
    }
    if (!decision.behaviorContract || typeof decision.behaviorContract !== "object") {
        throw new Error(`Audit decision ${decision.sha} has no behavior contract`);
    }
    for (const key of auditDecisionContractKeys) {
        validateStringList(decision.behaviorContract[key], `behaviorContract.${key}`, decision.sha);
    }
    validateStringList(decision.codeEvidence, "codeEvidence", decision.sha);
    validateStringList(decision.testEvidence, "testEvidence", decision.sha);
    validateStringList(decision.notes, "notes", decision.sha);
};

/** Applies versioned human-reviewed behavior evidence without touching generated Git mappings. */
export const applyAuditDecisions = ({repo, output, decisionsPath}) => {
    const cyclePath = resolve(output, "cycle.json");
    const manifestPath = resolve(output, "commits.jsonl");
    const cycle = JSON.parse(readFileSync(cyclePath, "utf8"));
    const source = JSON.parse(readFileSync(decisionsPath, "utf8"));
    if (source.cycleId !== cycle.cycleId || !Array.isArray(source.decisions)) {
        throw new Error("Audit decision file does not match the manifest cycle");
    }
    const records = readFileSync(manifestPath, "utf8")
        .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const recordsBySha = new Map(records.map((record) => [record.sha, record]));
    const seen = new Set();
    for (const decision of source.decisions) {
        validateAuditDecision(decision);
        if (seen.has(decision.sha)) {
            throw new Error(`Duplicate audit decision for ${decision.sha}`);
        }
        seen.add(decision.sha);
        const record = recordsBySha.get(decision.sha);
        if (!record) {
            throw new Error(`Audit decision references unknown upstream commit ${decision.sha}`);
        }
        record.audit = {
            ...record.audit,
            status: decision.status,
            intent: decision.intent,
            behaviorContract: decision.behaviorContract,
            disposition: decision.disposition,
            seriesId: decision.seriesId,
            codeEvidence: decision.codeEvidence,
            testEvidence: decision.testEvidence,
            notes: decision.notes,
        };
    }
    writeAuditManifest({repo, output, cycle, records});
    verifyAuditManifest({repo, output});
    return {cycleId: cycle.cycleId, appliedDecisionCount: seen.size};
};

export const refreshAuditManifest = ({repo, output}) => {
    const cyclePath = resolve(output, "cycle.json");
    if (!existsSync(cyclePath)) {
        throw new Error(`Missing frozen cycle configuration: ${cyclePath}`);
    }
    const cycle = JSON.parse(readFileSync(cyclePath, "utf8"));
    const candidateHead = runGit(repo, ["rev-parse", "HEAD"]).trim();
    const candidateBranch = runGit(repo, ["branch", "--show-current"]).trim();
    const refreshedCycle = {
        ...cycle,
        candidateBranch: candidateBranch || cycle.candidateBranch,
        candidateHead,
    };
    const records = buildAuditRecords({
        repo,
        upstreamBase: refreshedCycle.upstreamBase,
        upstreamTip: refreshedCycle.upstreamTip,
        localBase: refreshedCycle.localBase,
        candidateHead,
        existingManifestPath: resolve(output, "commits.jsonl"),
    });
    return writeAuditManifest({repo, output, cycle: refreshedCycle, records});
};

export const advanceAuditTip = ({repo, output, upstreamTip, fetchedAt}) => {
    const cyclePath = resolve(output, "cycle.json");
    if (!existsSync(cyclePath)) {
        throw new Error(`Missing frozen cycle configuration: ${cyclePath}`);
    }
    if (!fetchedAt || Number.isNaN(Date.parse(fetchedAt))) {
        throw new Error("A valid fetchedAt timestamp is required");
    }
    const cycle = JSON.parse(readFileSync(cyclePath, "utf8"));
    const previousTip = runGit(repo, ["rev-parse", "--verify", `${cycle.upstreamTip}^{commit}`]).trim();
    const nextTip = runGit(repo, ["rev-parse", "--verify", `${upstreamTip}^{commit}`]).trim();
    try {
        runGit(repo, ["merge-base", "--is-ancestor", previousTip, nextTip]);
    } catch {
        throw new Error(`Refusing non-fast-forward upstream tip change: ${previousTip} -> ${nextTip}`);
    }
    const tipHistory = cycle.upstreamTipRefresh?.history ?? [];
    if (previousTip === nextTip) {
        const checkedCycle = {
            ...cycle,
            upstreamTipFetchedAt: fetchedAt,
            upstreamTipRefresh: {
                mode: "before-each-series-and-final-closure",
                latestCheckedAt: fetchedAt,
                history: tipHistory,
            },
        };
        writeFileSync(cyclePath, `${JSON.stringify(checkedCycle, null, 2)}\n`);
        verifyAuditManifest({repo, output});
        return checkedCycle;
    }
    const candidateHead = runGit(repo, ["rev-parse", "HEAD"]).trim();
    const candidateBranch = runGit(repo, ["branch", "--show-current"]).trim();
    const addedCommitCount = Number(runGit(repo, [
        "rev-list", "--count", nextTip, `^${previousTip}`,
    ]).trim());
    const addedMergeCommitCount = Number(runGit(repo, [
        "rev-list", "--count", "--merges", nextTip, `^${previousTip}`,
    ]).trim());
    const refreshedCycle = {
        ...cycle,
        upstreamTip: nextTip,
        upstreamTipFetchedAt: fetchedAt,
        candidateBranch: candidateBranch || cycle.candidateBranch,
        candidateHead,
        upstreamTipRefresh: {
            mode: "before-each-series-and-final-closure",
            latestCheckedAt: fetchedAt,
            history: [
                ...tipHistory,
                {
                    from: previousTip,
                    to: nextTip,
                    fetchedAt,
                    addedCommitCount,
                    addedMergeCommitCount,
                },
            ],
        },
    };
    const records = buildAuditRecords({
        repo,
        upstreamBase: refreshedCycle.upstreamBase,
        upstreamTip: nextTip,
        localBase: refreshedCycle.localBase,
        candidateHead,
        existingManifestPath: resolve(output, "commits.jsonl"),
    });
    const result = writeAuditManifest({repo, output, cycle: refreshedCycle, records});
    verifyAuditManifest({repo, output});
    return result;
};

const requireOption = (values, name) => {
    if (!values[name]) {
        throw new Error(`Missing --${name}`);
    }
    return values[name];
};

const main = () => {
    const {positionals, values} = parseArgs({
        allowPositionals: true,
        options: {
            repo: {type: "string", default: "."},
            output: {type: "string"},
            "cycle-id": {type: "string"},
            "local-base": {type: "string"},
            "upstream-base": {type: "string"},
            "upstream-tip": {type: "string"},
            "fetched-at": {type: "string"},
            "candidate-branch": {type: "string"},
            "candidate-head": {type: "string"},
            "candidate-created-at": {type: "string"},
            "frozen-at": {type: "string"},
            "procedure-block-id": {type: "string"},
            "procedure-updated-at": {type: "string"},
            "procedure-kramdown-sha256": {type: "string"},
            "procedure-mirror-sha256": {type: "string"},
            decisions: {type: "string"},
        },
    });
    const command = positionals[0];
    const repo = resolve(values.repo);
    const output = resolve(requireOption(values, "output"));
    if (command === "verify") {
        process.stdout.write(`${JSON.stringify(verifyAuditManifest({repo, output}))}\n`);
        return;
    }
    if (command === "coverage") {
        const coverage = writeUpstreamCoverage({repo, output});
        process.stdout.write(`${JSON.stringify({
            sourceHead: coverage.sourceHead,
            semanticVerified: coverage.semanticVerified.count,
            deliveryIntegrated: coverage.deliveryIntegrated.count,
            topologyCovered: coverage.topologyCovered.count,
            pending: coverage.pending.count,
            topologyLag: coverage.topologyLag.count,
            semanticVerifiedPrefix: coverage.reconciliation.semanticVerifiedPrefix,
            deliveryIntegratedPrefix: coverage.reconciliation.deliveryIntegratedPrefix,
            topologyIntegratedPrefix: coverage.reconciliation.topologyIntegratedPrefix,
            firstActionable: coverage.reconciliation.firstActionable,
        })}\n`);
        return;
    }
    if (command === "reconcile") {
        const coverage = writeUpstreamCoverage({repo, output});
        process.stdout.write(`${JSON.stringify({
            sourceHead: coverage.sourceHead,
            reconciliation: coverage.reconciliation,
            states: coverage.reconciliation.stateCounts,
        })}\n`);
        return;
    }
    if (command === "refresh") {
        const result = refreshAuditManifest({repo, output});
        process.stdout.write(`${JSON.stringify({
            candidateHead: result.candidateHead,
            commitCount: result.commitCount,
            mappedUpstreamCommitCount: result.mappedUpstreamCommitCount,
        })}\n`);
        return;
    }
    if (command === "apply-decisions") {
        const result = applyAuditDecisions({
            repo,
            output,
            decisionsPath: resolve(requireOption(values, "decisions")),
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    if (command === "advance-tip") {
        const result = advanceAuditTip({
            repo,
            output,
            upstreamTip: requireOption(values, "upstream-tip"),
            fetchedAt: requireOption(values, "fetched-at"),
        });
        process.stdout.write(`${JSON.stringify({
            upstreamTip: result.upstreamTip,
            candidateHead: result.candidateHead,
            commitCount: result.commitCount,
            mergeCommitCount: result.mergeCommitCount,
            mappedUpstreamCommitCount: result.mappedUpstreamCommitCount,
        })}\n`);
        return;
    }
    if (command !== "generate") {
        throw new Error("Expected generate, refresh, apply-decisions, advance-tip, coverage, reconcile or verify command");
    }
    const generatedCycle = {
        cycleId: requireOption(values, "cycle-id"),
        upstreamRemote: "https://github.com/siyuan-note/siyuan.git",
        upstreamBranch: "dev",
        localBase: requireOption(values, "local-base"),
        upstreamBase: requireOption(values, "upstream-base"),
        upstreamTip: requireOption(values, "upstream-tip"),
        candidateBranch: requireOption(values, "candidate-branch"),
        candidateHead: requireOption(values, "candidate-head"),
        candidateCreatedAt: requireOption(values, "candidate-created-at"),
        frozenAt: requireOption(values, "frozen-at"),
        requiredGates: [
            "kernel: go test -short -tags fts5 ./...",
            "kernel: go vet -tags fts5 ./...",
            "app: pnpm typecheck",
            "app: pnpm test",
            "app: pnpm test:browser",
            "app: pnpm build",
        ],
        procedure: {
            blockId: requireOption(values, "procedure-block-id"),
            updatedAt: requireOption(values, "procedure-updated-at"),
            kramdownSha256: requireOption(values, "procedure-kramdown-sha256"),
            mirrorSha256: requireOption(values, "procedure-mirror-sha256"),
        },
    };
    const cycle = loadCycleForRegeneration(output, generatedCycle);
    const manifestPath = resolve(output, "commits.jsonl");
    const records = buildAuditRecords({
        repo,
        upstreamBase: cycle.upstreamBase,
        upstreamTip: cycle.upstreamTip,
        localBase: cycle.localBase,
        candidateHead: cycle.candidateHead,
        existingManifestPath: manifestPath,
    });
    const result = writeAuditManifest({repo, output, cycle, records});
    process.stdout.write(`${JSON.stringify({commitCount: result.commitCount, mergeCommitCount: result.mergeCommitCount})}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main();
}
