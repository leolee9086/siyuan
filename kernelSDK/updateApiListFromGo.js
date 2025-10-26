import { writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_ROUTER_GO_URL = 'https://raw.githubusercontent.com/siyuan-note/siyuan/master/kernel/api/router.go';
const OUTPUT_FILENAME = 'rawApiList.json';
const DIFF_FILENAME = 'diff.md';

async function fetchRouterGoContent() {
  try {
    const response = await fetch(GITHUB_ROUTER_GO_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch router.go: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching router.go:', error);
    throw error;
  }
}

function parseGoCode(goContent) {
  const rawApis = [];
  const lines = goContent.split('\n');

  const serveApiFuncStart = lines.findIndex(line => line.includes("func ServeAPI(ginServer *gin.Engine)"));
  const confApiRouteFuncStart = lines.findIndex(line => line.includes("func ConfAPIRoute(ginServer *gin.Engine)"));
  const apiRouteV2FuncStart = lines.findIndex(line => line.includes("func APIRouteV2(ginServer *gin.Engine)"));

  const processLines = (startIndex, apiArray) => {
    if (startIndex === -1) return;

    for (let i = startIndex; i < lines.length; i++) {
      let line = lines[i].trim();
      if (i > startIndex && (line.startsWith("func ") || line.startsWith("}"))) break;
      if (line.startsWith('//') || !line.includes('ginServer.Handle(')) continue;
      line = line.split('//')[0].trim();
      if (!line) continue;

      const handleRegex = /ginServer\.Handle\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"((?:\s*,\s*(?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)*)?\s*,\s*([a-zA-Z0-9_\.]+)\s*\)/;
      const match = line.match(handleRegex);

      if (match) {
        const method = match[1];
        const endpoint = match[2];
        const authChecksRawString = match[3];
        let en = match[4];

        const enParts = en.split('.');
        en = enParts[enParts.length - 1];

        if (en.includes(",")) {
            const enCommaParts = en.split(",");
            en = enCommaParts[enCommaParts.length -1].trim();
        }

        let needAuth = false;
        let needAdminRole = false;
        let unavailableIfReadonly = false;
        let otherAuthChecks = [];

        if (authChecksRawString) {
          const checks = authChecksRawString.substring(1).split(/\s*,\s*/).map(s => s.trim()).filter(s => s);
          checks.forEach(check => {
            if (check === "model.CheckAuth") {
              needAuth = true;
            } else if (check === "model.CheckAdminRole") {
              needAdminRole = true;
            } else if (check === "model.CheckReadonly") {
              unavailableIfReadonly = true;
            } else {
              otherAuthChecks.push(check);
            }
          });
        }

        if (!apiArray.some(api => api.endpoint === endpoint && api.method === method)) {
          apiArray.push({
            method,
            endpoint,
            en,
            needAuth,
            needAdminRole,
            unavailableIfReadonly,
            otherAuthChecks
          });
        }
      }
    }
  };

  console.log("Processing APIs from ServeAPI...");
  processLines(serveApiFuncStart, rawApis);
  console.log("Processing APIs from ConfAPIRoute...");
  processLines(confApiRouteFuncStart, rawApis);
  console.log("Processing APIs from APIRouteV2...");
  processLines(apiRouteV2FuncStart, rawApis);

  return rawApis;
}

function compareApiLists(oldList, newList) {
  const oldMap = new Map(oldList.map(api => [`${api.method}|${api.endpoint}`, api]));
  const newMap = new Map(newList.map(api => [`${api.method}|${api.endpoint}`, api]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, newApi] of newMap.entries()) {
    if (!oldMap.has(key)) {
      added.push(newApi);
    } else {
      const oldApi = oldMap.get(key);
      if (JSON.stringify(oldApi) !== JSON.stringify(newApi)) {
        changed.push({ old: oldApi, new: newApi });
      }
    }
  }

  for (const [key, oldApi] of oldMap.entries()) {
    if (!newMap.has(key)) {
      removed.push(oldApi);
    }
  }

  return { added, removed, changed };
}

function formatDiffToMarkdown(diff) {
  let markdown = '# API Changes\n\n';
  let hasChanges = false;

  if (diff.added.length > 0) {
    hasChanges = true;
    markdown += '## Added APIs\n\n';
    markdown += '| Method | Endpoint | Handler | Auth |\n';
    markdown += '|---|---|---|---|\n';
    diff.added.forEach(api => {
      const authInfo = [];
      if (api.needAuth) authInfo.push('Auth');
      if (api.needAdminRole) authInfo.push('Admin');
      if (api.unavailableIfReadonly) authInfo.push('Readonly');
      markdown += `| ${api.method} | \`${api.endpoint}\` | \`${api.en}\` | ${authInfo.join(', ')} |\n`;
    });
    markdown += '\n';
  }

  if (diff.removed.length > 0) {
    hasChanges = true;
    markdown += '## Removed APIs\n\n';
    markdown += '| Method | Endpoint | Handler |\n';
    markdown += '|---|---|---|\n';
    diff.removed.forEach(api => {
      markdown += `| ${api.method} | \`${api.endpoint}\` | \`${api.en}\` |\n`;
    });
    markdown += '\n';
  }

  if (diff.changed.length > 0) {
    hasChanges = true;
    markdown += '## Changed APIs\n\n';
    diff.changed.forEach(change => {
      markdown += `### \`${change.new.method}\` \`${change.new.endpoint}\`\n\n`;
      markdown += '```diff\n';
      markdown += `- ${JSON.stringify(change.old, null, 2)}\n`;
      markdown += `+ ${JSON.stringify(change.new, null, 2)}\n`;
      markdown += '```\n\n';
    });
  }

  return hasChanges ? markdown : '';
}

async function main() {
  console.log('Fetching router.go from GitHub...');
  const goContent = await fetchRouterGoContent();
  console.log('Parsing router.go content...');
  const rawApiList = parseGoCode(goContent);
  
  const uniqueApiList = rawApiList.filter((api, index, self) => 
    index === self.findIndex(t => (
      t.method === api.method && 
      t.endpoint === api.endpoint && 
      t.en === api.en &&
      t.needAuth === api.needAuth &&
      t.needAdminRole === api.needAdminRole &&
      t.unavailableIfReadonly === api.unavailableIfReadonly &&
      JSON.stringify(t.otherAuthChecks.sort()) === JSON.stringify(api.otherAuthChecks.sort())
    ))
  );

  console.log(`Found ${uniqueApiList.length} unique APIs after parsing.`);

  const outputPath = join(__dirname, OUTPUT_FILENAME);
  const diffPath = join(__dirname, DIFF_FILENAME);

  let oldApiList = [];
  try {
    const oldContent = await readFile(outputPath, 'utf8');
    oldApiList = JSON.parse(oldContent);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error reading old ${OUTPUT_FILENAME}:`, error);
    }
  }

  const diff = compareApiLists(oldApiList, uniqueApiList);
  const markdownDiff = formatDiffToMarkdown(diff);

  if (markdownDiff) {
    try {
      await writeFile(diffPath, markdownDiff, 'utf8');
      console.log(`Successfully generated ${DIFF_FILENAME} at ${diffPath}`);
    } catch (error) {
      console.error(`Error writing ${DIFF_FILENAME}:`, error);
    }
  } else {
    console.log('No changes detected, diff.md not generated.');
  }

  try {
    await writeFile(outputPath, JSON.stringify(uniqueApiList, null, 2), 'utf8');
    console.log(`Successfully generated ${OUTPUT_FILENAME} with ${uniqueApiList.length} APIs at ${outputPath}`);
  } catch (error) {
    console.error(`Error writing ${OUTPUT_FILENAME}:`, error);
  }
}

main().catch(err => {
  console.error('Script execution failed:', err);
  process.exit(1);
}); 