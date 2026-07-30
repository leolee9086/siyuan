import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {parseArgs} from "node:util";

const REQUIRED_SEMANTICS = [
    "运行时新鲜度检查必须由版本化 Git hooks 在提交时自动执行",
    "pnpm forge",
    "一次性开发构建",
    "每次 Kernel crash",
    "post-commit",
    "不得为了减少",
    "囤积可独立交付",
    "本地 Forge 服务是硬门禁",
    "规范化 Kramdown SHA-256",
    "IAL 属性顺序不稳定",
    "每个新 series 建立前",
];

const ialTokenPattern = /[^\s=]+=(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s]+)|[^\s]+/gu;

export const canonicalizeKramdown = (value) => value
    .replace(/\r\n?/gu, "\n")
    .replace(/\{:\s*([^{}\r\n]*)\}/gu, (_match, attributes) => {
        const tokens = attributes.match(ialTokenPattern) ?? [];
        return `{${tokens.length > 0 ? `: ${tokens.sort().join(" ")}` : ":"}}`;
    });

export const hashCanonicalKramdown = (value) => createHash("sha256")
    .update(canonicalizeKramdown(value), "utf8")
    .digest("hex");

export const verifyProcedureSemantics = (value) => {
    const normalized = value.replaceAll("\u200b", "");
    const missing = REQUIRED_SEMANTICS.filter((item) => !normalized.includes(item));
    if (missing.length > 0) {
        throw new Error(`Published procedure is missing required semantics: ${missing.join(", ")}`);
    }
    return REQUIRED_SEMANTICS.length;
};

const postJSON = async (baseURL, route, body, fetchImpl = globalThis.fetch) => {
    const response = await fetchImpl(new URL(route, baseURL), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`${route} returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload.code !== 0) {
        throw new Error(`${route} failed: ${payload.msg || `code ${payload.code}`}`);
    }
    return payload.data;
};

const readProcedureBlock = async (baseURL, blockID, fetchImpl) => {
    const data = await postJSON(baseURL, "/api/block/getBlockKramdown", {id: blockID}, fetchImpl);
    if (typeof data?.kramdown !== "string") {
        throw new Error("getBlockKramdown returned no Kramdown text");
    }
    return data.kramdown;
};

export const verifyPublishedProcedure = async ({
    baseURL,
    blockID,
    fetchImpl = globalThis.fetch,
}) => {
    const first = await readProcedureBlock(baseURL, blockID, fetchImpl);
    const second = await readProcedureBlock(baseURL, blockID, fetchImpl);
    const firstHash = hashCanonicalKramdown(first);
    const secondHash = hashCanonicalKramdown(second);
    if (firstHash !== secondHash) {
        throw new Error(`Canonical Kramdown is unstable: ${firstHash} != ${secondHash}`);
    }
    const rootAttributes = [...second.matchAll(/\{:\s*([^{}\r\n]*)\}/gu)]
        .map((match) => match[1])
        .find((attributes) => attributes.includes(`id="${blockID}"`));
    const updatedAt = rootAttributes ? /(?:^|\s)updated="(\d+)"(?:\s|$)/u.exec(rootAttributes)?.[1] : undefined;
    return {
        blockId: blockID,
        updatedAt: updatedAt ?? null,
        canonicalKramdownSha256: secondHash,
        hashNormalization: "LF line endings and lexicographically sorted Kramdown IAL attributes",
        semanticChecks: verifyProcedureSemantics(second),
        kramdownLength: second.length,
    };
};

export const publishAndVerifyProcedure = async ({
    baseURL,
    blockID,
    markdown,
    fetchImpl = globalThis.fetch,
}) => {
    await postJSON(baseURL, "/api/block/updateBlock", {
        dataType: "markdown",
        data: markdown,
        id: blockID,
    }, fetchImpl);
    return verifyPublishedProcedure({baseURL, blockID, fetchImpl});
};

const requireOption = (values, name) => {
    if (!values[name]) {
        throw new Error(`Missing --${name}`);
    }
    return values[name];
};

const main = async () => {
    const {values} = parseArgs({
        options: {
            "base-url": {type: "string", default: "http://127.0.0.1:6806"},
            "block-id": {type: "string"},
            file: {type: "string"},
            "verify-only": {type: "boolean", default: false},
        },
    });
    const options = {
        baseURL: values["base-url"],
        blockID: requireOption(values, "block-id"),
    };
    const result = values["verify-only"] ?
        await verifyPublishedProcedure(options) :
        await publishAndVerifyProcedure({
            ...options,
            markdown: readFileSync(resolve(requireOption(values, "file")), "utf8"),
        });
    process.stdout.write(`${JSON.stringify(result)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    });
}
