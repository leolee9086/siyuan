import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
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
        const header = segment.replace(/^\r?\n/, "").split(/\r?\n/, 1)[0];
        const [sha, parents, authorName, authorEmail, authoredAt, subject] = header.split("\0");
        if (!sha || subject === undefined) {
            throw new Error("Malformed git metadata record");
        }
        records.set(sha, {
            sha,
            parents: parents ? parents.split(" ") : [],
            author: {name: authorName, email: authorEmail},
            authoredAt,
            subject,
        });
    }
    return records;
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
    const patch = runGit(repo, ["show", "--pretty=format:", "--no-ext-diff", "--binary", sha], {
        encoding: null,
    });
    if (patch.length === 0) {
        return null;
    }
    const output = runGit(repo, ["patch-id", "--stable"], {input: patch}).trim();
    return output ? output.split(/\s+/, 1)[0] : null;
};

export const buildAuditRecords = ({repo, upstreamBase, upstreamTip, existingManifestPath}) => {
    runGit(repo, ["merge-base", "--is-ancestor", upstreamBase, upstreamTip]);
    const shas = runGit(repo, [
        "rev-list", "--reverse", "--topo-order", upstreamTip, `^${upstreamBase}`,
    ]).trim().split(/\r?\n/).filter(Boolean);
    const metadata = parseMetadataLog(runGit(repo, [
        "log", "--format=%x1e%H%x00%P%x00%an%x00%ae%x00%aI%x00%s", upstreamTip, `^${upstreamBase}`,
    ]));
    const existingAudits = readExistingAudits(existingManifestPath);

    return shas.map((sha, index) => {
        const item = metadata.get(sha);
        if (!item) {
            throw new Error(`Missing metadata for ${sha}`);
        }
        const isMerge = item.parents.length > 1;
        return {
            ...item,
            topoIndex: index + 1,
            commitType: isMerge ? "merge" : "commit",
            paths: getChangedPaths(repo, sha),
            stablePatchId: getStablePatchId(repo, sha, isMerge),
            audit: existingAudits.get(sha) ?? emptyAudit(),
        };
    });
};

export const writeAuditManifest = ({repo, output, cycle, records}) => {
    mkdirSync(output, {recursive: true});
    const manifestPath = resolve(output, "commits.jsonl");
    const mergeCommitCount = records.filter((record) => record.commitType === "merge").length;
    const cycleRecord = {
        schemaVersion: 1,
        generator: "scripts/upstream-sync/audit-manifest.mjs",
        ...cycle,
        commitCount: records.length,
        mergeCommitCount,
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
    if (cycle.commitCount !== records.length || cycle.mergeCommitCount !== mergeCommitCount) {
        throw new Error("cycle.json counts do not match commits.jsonl");
    }
    return {commitCount: records.length, mergeCommitCount};
};

const requireOption = (values, name) => {
    if (!values[name]) {
        throw new Error(`Missing --${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    }
    return values[name];
};

const main = () => {
    const {positionals, values} = parseArgs({
        allowPositionals: true,
        options: {
            repo: {type: "string", default: "."},
            output: {type: "string"},
            cycleId: {type: "string"},
            localBase: {type: "string"},
            upstreamBase: {type: "string"},
            upstreamTip: {type: "string"},
            candidateBranch: {type: "string"},
            frozenAt: {type: "string"},
            procedureBlockId: {type: "string"},
            procedureUpdatedAt: {type: "string"},
            procedureKramdownSha256: {type: "string"},
            procedureMirrorSha256: {type: "string"},
        },
    });
    const command = positionals[0];
    const repo = resolve(values.repo);
    const output = resolve(requireOption(values, "output"));
    if (command === "verify") {
        process.stdout.write(`${JSON.stringify(verifyAuditManifest({repo, output}))}\n`);
        return;
    }
    if (command !== "generate") {
        throw new Error("Expected generate or verify command");
    }
    const cycle = {
        cycleId: requireOption(values, "cycleId"),
        upstreamRemote: "https://github.com/siyuan-note/siyuan.git",
        upstreamBranch: "dev",
        localBase: requireOption(values, "localBase"),
        upstreamBase: requireOption(values, "upstreamBase"),
        upstreamTip: requireOption(values, "upstreamTip"),
        candidateBranch: requireOption(values, "candidateBranch"),
        frozenAt: requireOption(values, "frozenAt"),
        requiredGates: [
            "kernel: go test -short -tags fts5 ./...",
            "kernel: go vet -tags fts5 ./...",
            "app: pnpm typecheck",
            "app: pnpm test",
            "app: pnpm test:browser",
            "app: pnpm build",
        ],
        procedure: {
            blockId: requireOption(values, "procedureBlockId"),
            updatedAt: requireOption(values, "procedureUpdatedAt"),
            kramdownSha256: requireOption(values, "procedureKramdownSha256"),
            mirrorSha256: requireOption(values, "procedureMirrorSha256"),
        },
    };
    const manifestPath = resolve(output, "commits.jsonl");
    const records = buildAuditRecords({
        repo,
        upstreamBase: cycle.upstreamBase,
        upstreamTip: cycle.upstreamTip,
        existingManifestPath: manifestPath,
    });
    const result = writeAuditManifest({repo, output, cycle, records});
    process.stdout.write(`${JSON.stringify({commitCount: result.commitCount, mergeCommitCount: result.mergeCommitCount})}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main();
}
