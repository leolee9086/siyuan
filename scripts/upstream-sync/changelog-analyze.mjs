import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
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

/**
 * 解析 changelog markdown 为分类条目列表。
 * 分节标题以 "### " 开头；条目以 "* [" 开头并包含 siyuan issues/pull 链接。
 * 分类名称原样保留（英文 Feature/Enhancement/... 或中文 引入特性/改进功能/...）。
 */
export const parseChangelog = (markdown) => {
    const entries = [];
    let category = null;
    for (const rawLine of markdown.split(/\r?\n/u)) {
        const line = rawLine.trim();
        const sectionMatch = /^###\s+(.+)$/u.exec(line);
        if (sectionMatch) {
            category = sectionMatch[1].trim();
            continue;
        }
        if (!category || !line.startsWith("* [")) {
            continue;
        }
        const itemMatch = /^\* \[(.*?)\]\(https:\/\/github\.com\/siyuan-note\/siyuan\/(issues|pull)\/(\d+)\)/u.exec(line);
        if (!itemMatch) {
            continue;
        }
        entries.push({
            category,
            title: itemMatch[1].trim(),
            issueType: itemMatch[2],
            issue: Number(itemMatch[3]),
        });
    }
    return entries;
};

const readCommitFile = (path) => {
    if (!existsSync(path)) {
        throw new Error(`Missing commit manifest: ${path}`);
    }
    const commits = [];
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        if (line.startsWith("{")) {
            const record = JSON.parse(line);
            commits.push({
                sha: record.sha,
                date: record.authoredAt ?? record.date ?? null,
                subject: record.subject ?? "",
            });
        } else {
            const [sha, date, ...subjectParts] = line.split("|");
            commits.push({sha, date: date ?? null, subject: subjectParts.join("|")});
        }
    }
    return commits;
};

const listCommitsFromGit = (repo, range) => {
    const output = runGit(repo, [
        "log", "--reverse", "--topo-order", "--format=%H|%aI|%s", range,
    ]);
    return output.split(/\r?\n/u).filter(Boolean).map((line) => {
        const [sha, date, ...subjectParts] = line.split("|");
        return {sha, date: date ?? null, subject: subjectParts.join("|")};
    });
};

const extractIssueNumbers = (subject) => {
    const issues = new Set();
    for (const match of subject.matchAll(/siyuan\/(?:issues|pull)\/(\d+)/gu)) {
        issues.add(Number(match[1]));
    }
    return issues;
};

/**
 * 建立 "issue 号 -> 提交列表" 索引。一个提交可以关联多个 issue。
 */
export const buildIssueIndex = (commits) => {
    const index = new Map();
    for (const commit of commits) {
        for (const issue of extractIssueNumbers(commit.subject)) {
            const list = index.get(issue) ?? [];
            list.push(commit);
            index.set(issue, list);
        }
    }
    return index;
};

/**
 * 将 changelog 条目映射到上游提交。
 * 返回 { entries, summary }；summary 含总条目、已匹配/未匹配计数和分类统计。
 */
export const analyzeChangelog = ({entries, commits}) => {
    const issueIndex = buildIssueIndex(commits);
    const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
    const mappedEntries = entries.map((entry) => {
        const related = (issueIndex.get(entry.issue) ?? [])
            .map((commit) => commit.sha)
            .filter((sha) => bySha.has(sha));
        return {...entry, commits: related};
    });
    const matched = mappedEntries.filter((entry) => entry.commits.length > 0);
    const unmatched = mappedEntries.filter((entry) => entry.commits.length === 0);
    const categoryCounts = {};
    for (const entry of entries) {
        categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1;
    }
    return {
        entries: mappedEntries,
        summary: {
            totalEntries: entries.length,
            matchedEntries: matched.length,
            unmatchedEntries: unmatched.length,
            categoryCounts,
        },
        unmatched,
    };
};

const main = () => {
    const {values} = parseArgs({
        allowPositionals: true,
        options: {
            changelog: {type: "string"},
            commits: {type: "string"},
            repo: {type: "string"},
            range: {type: "string"},
            output: {type: "string"},
        },
    });
    if (!values.changelog) {
        throw new Error("Missing --changelog <path>");
    }
    const changelogPath = resolve(values.changelog);
    if (!existsSync(changelogPath)) {
        throw new Error(`Missing changelog file: ${changelogPath}`);
    }
    const entries = parseChangelog(readFileSync(changelogPath, "utf8"));
    let commits;
    if (values.commits) {
        commits = readCommitFile(resolve(values.commits));
    } else if (values.repo && values.range) {
        commits = listCommitsFromGit(resolve(values.repo), values.range);
    } else {
        throw new Error("Provide --commits <file> or --repo <path> with --range <U0..U1>");
    }
    const result = analyzeChangelog({entries, commits});
    const output = {
        schemaVersion: 1,
        changelog: changelogPath,
        commitSource: values.commits ? resolve(values.commits) : `${resolve(values.repo)} ${values.range}`,
        commitCount: commits.length,
        summary: result.summary,
        entries: result.entries,
        unmatched: result.unmatched,
    };
    if (values.output) {
        writeFileSync(resolve(values.output), `${JSON.stringify(output, null, 2)}\n`);
        process.stdout.write(`${JSON.stringify({
            totalEntries: output.summary.totalEntries,
            matchedEntries: output.summary.matchedEntries,
            unmatchedEntries: output.summary.unmatchedEntries,
            commitCount: output.commitCount,
        })}\n`);
    } else {
        process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main();
}
