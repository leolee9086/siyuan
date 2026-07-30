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

const readExistingAudits = (manifestPath) => {
    if (!existsSync(manifestPath)) {
        return new Map();
    }
    const audits = new Map();
    for (const line of readFileSync(manifestPath, "utf8").split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const record = JSON.parse(line);
        if (record.sha && record.audit) {
            audits.set(record.sha, record.audit);
        }
    }
    return audits;
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
    const existingAudits = readExistingAudits(existingManifestPath);
    const localMappings = readLocalMappings(repo, localBase, candidateHead);

    const records = shas.map((sha, index) => {
        const item = metadata.get(sha);
        if (!item) {
            throw new Error(`Missing metadata for ${sha}`);
        }
        const isMerge = item.parents.length > 1;
        const revertTargets = getRevertTargets(repo, item.body);
        const isRevert = !isMerge && (revertTargets.length > 0 || /^Revert\b/u.test(item.subject));
        const audit = mergeAuditMapping(
            existingAudits.get(sha) ?? emptyAudit(),
            localMappings.get(sha) ?? [],
            revertTargets,
        );
        const {body: _body, ...publicItem} = item;
        return {
            ...publicItem,
            topoIndex: index + 1,
            commitType: isMerge ? "merge" : (isRevert ? "revert" : "commit"),
            paths: getChangedPaths(repo, sha),
            stablePatchId: getStablePatchId(repo, sha, isMerge),
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
        throw new Error("Expected generate, refresh, apply-decisions, advance-tip or verify command");
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
