import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RAW_API_LIST_PATH = join(__dirname, 'rawApiList.json');
const API_DEFS_DIR = join(__dirname, 'apiDefs');

// Helper function to parse apiDef content (assuming it's `export const xxx = [...]`)
async function parseApiDefContent(filePath, groupName) {
  try {
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl + '?cacheBust=' + Date.now());
    const variableName = `${groupName}ApiDefs`;
    if (module && module[variableName] && Array.isArray(module[variableName])) {
      return module[variableName];
    }
    return [];
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      return [];
    }
    console.warn(`[Warning] Failed to import module from ${filePath}: ${error.message}. Proceeding with empty definitions for this file.`);
    return [];
  }
}

// Normalize function for robust string comparison of Zod schemas
const normalize = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, '').replace(/\\n/g, '');
};

async function main() {
  let rawApiList;
  try {
    const rawApiContent = await readFile(RAW_API_LIST_PATH, 'utf8');
    rawApiList = JSON.parse(rawApiContent);
  } catch (error) {
    console.error(`[Error] Failed to read or parse ${RAW_API_LIST_PATH}:`, error);
    process.exit(1);
  }

  const groupedRawApis = {};
  for (const rawApi of rawApiList) {
    const parts = rawApi.endpoint.split('/');
    const groupName = (parts.length > 2 && parts[1] === 'api') ? parts[2] : 'misc';
    if (!groupedRawApis[groupName]) groupedRawApis[groupName] = [];
    groupedRawApis[groupName].push(rawApi);
  }

  console.log("Starting API Definition Validation Process...\n");
  let totalFilesProcessed = 0;
  const validationIssues = [];

  const apiDefFiles = await readdir(API_DEFS_DIR);

  for (const groupName of Object.keys(groupedRawApis)) {
    totalFilesProcessed++;
    const defFileName = `${groupName}.js`;
    
    if (!apiDefFiles.includes(defFileName)) {
        validationIssues.push({
            type: "MissingDefFile",
            group: groupName,
            message: `Definition file ${defFileName} is missing in ${API_DEFS_DIR} but raw APIs exist for this group.`
        });
        // If file is missing, all its raw APIs are effectively "new" or "unmatched"
        groupedRawApis[groupName].forEach(rawApi => {
            validationIssues.push({
                type: "MissingApiInDefFile",
                group: groupName,
                method: rawApi.method,
                endpoint: rawApi.endpoint,
                message: `API ${rawApi.method} ${rawApi.endpoint} found in rawApiList.json but its definition file ${defFileName} is missing.`
            });
        });
        continue; // Skip to next group if def file is missing
    }
    
    const defFilePath = join(API_DEFS_DIR, defFileName);
    const existingDefApis = await parseApiDefContent(defFilePath, groupName);

    const currentRawApis = groupedRawApis[groupName] || [];
    const processedEndpointsInDef = new Set();

    // Check APIs defined in the .js file against rawApiList.json
    for (const defApi of existingDefApis) {
      const endpointKey = `${defApi.method} ${defApi.endpoint}`;
      processedEndpointsInDef.add(endpointKey);

      const rawApiMatch = currentRawApis.find(raw => raw.method === defApi.method && raw.endpoint === defApi.endpoint);

      if (!rawApiMatch) {
        if (!defApi.deprecated) {
          validationIssues.push({
            type: "ApiShouldBeDeprecated",
            group: groupName,
            method: defApi.method,
            endpoint: defApi.endpoint,
            message: `API ${defApi.method} ${defApi.endpoint} in ${defFileName} is not in rawApiList.json and should be marked deprecated: true.`
          });
        }
      } else { // API exists in both raw and def file
        if (defApi.deprecated === true) {
          validationIssues.push({
            type: "ApiShouldNotBeDeprecated",
            group: groupName,
            method: defApi.method,
            endpoint: defApi.endpoint,
            message: `API ${defApi.method} ${defApi.endpoint} in ${defFileName} is marked deprecated: true but exists in rawApiList.json.`
          });
        }
        if (defApi.en !== rawApiMatch.en) {
          validationIssues.push({
            type: "EnMismatch",
            group: groupName,
            method: defApi.method,
            endpoint: defApi.endpoint,
            expected: rawApiMatch.en,
            actual: defApi.en,
            message: `EN mismatch for ${defApi.method} ${defApi.endpoint} in ${defFileName}. Expected: "${rawApiMatch.en}", Actual: "${defApi.en}".`
          });
        }
        const defAuth = {
          needAuth: defApi.needAuth || false,
          needAdminRole: defApi.needAdminRole || false,
          unavailableIfReadonly: defApi.unavailableIfReadonly || false,
          otherAuthChecks: (defApi.otherAuthChecks || []).sort()
        };
        const rawAuth = {
          needAuth: rawApiMatch.needAuth || false,
          needAdminRole: rawApiMatch.needAdminRole || false,
          unavailableIfReadonly: rawApiMatch.unavailableIfReadonly || false,
          otherAuthChecks: (rawApiMatch.otherAuthChecks || []).sort()
        };
        if (JSON.stringify(defAuth) !== JSON.stringify(rawAuth)) {
          validationIssues.push({
            type: "AuthMismatch",
            group: groupName,
            method: defApi.method,
            endpoint: defApi.endpoint,
            expected: rawAuth,
            actual: defAuth,
            message: `Auth flags mismatch for ${defApi.method} ${defApi.endpoint} in ${defFileName}.`
          });
        }
        if (defApi.zh_cn === undefined || defApi.zh_cn === null || defApi.zh_cn.trim() === '') {
          validationIssues.push({
            type: "MissingZhCn",
            group: groupName,
            method: defApi.method,
            endpoint: defApi.endpoint,
            message: `Missing zh_cn (Chinese name) for ${defApi.method} ${defApi.endpoint} in ${defFileName}.`
          });
        }
        if (defApi.description === undefined || defApi.description === null || defApi.description.trim() === '') {
          validationIssues.push({
            type: "MissingDescription",
            group: groupName,
            method: defApi.method,
            endpoint: defApi.endpoint,
            message: `Missing description for ${defApi.method} ${defApi.endpoint} in ${defFileName}.`
          });
        }
        
        const oldDefaultZodFuncStringForComparison = '(z)=>z.any()';
        const defaultZodFuncString = '(z)=>({})';

        const defReqSchemaStr = normalize(typeof defApi.zodRequestSchema === 'function' ? defApi.zodRequestSchema.toString() : defApi.zodRequestSchema);
        if (defReqSchemaStr === normalize(oldDefaultZodFuncStringForComparison)) {
            validationIssues.push({
                type: "OutdatedDefaultSchema",
                field: "zodRequestSchema",
                group: groupName,
                method: defApi.method,
                endpoint: defApi.endpoint,
                message: `zodRequestSchema for ${defApi.method} ${defApi.endpoint} in ${defFileName} is using outdated default '(z) => z.any()'. Should be '(z) => ({})'.`
            });
        } else if (defReqSchemaStr === '') {
             validationIssues.push({
                type: "MissingSchema",
                field: "zodRequestSchema",
                group: groupName,
                method: defApi.method,
                endpoint: defApi.endpoint,
                message: `zodRequestSchema for ${defApi.method} ${defApi.endpoint} in ${defFileName} is missing or empty.`
            });
        }

        const defResSchemaStr = normalize(typeof defApi.zodResponseSchema === 'function' ? defApi.zodResponseSchema.toString() : defApi.zodResponseSchema);
        if (defResSchemaStr === normalize(oldDefaultZodFuncStringForComparison)) {
            validationIssues.push({
                type: "OutdatedDefaultSchema",
                field: "zodResponseSchema",
                group: groupName,
                method: defApi.method,
                endpoint: defApi.endpoint,
                message: `zodResponseSchema for ${defApi.method} ${defApi.endpoint} in ${defFileName} is using outdated default '(z) => z.any()'. Should be '(z) => ({})'.`
            });
        } else if (defResSchemaStr === '') {
             validationIssues.push({
                type: "MissingSchema",
                field: "zodResponseSchema",
                group: groupName,
                method: defApi.method,
                endpoint: defApi.endpoint,
                message: `zodResponseSchema for ${defApi.method} ${defApi.endpoint} in ${defFileName} is missing or empty.`
            });
        }
      }
    }

    // Check for APIs in rawApiList.json that are not in the .js file
    for (const rawApi of currentRawApis) {
      const endpointKey = `${rawApi.method} ${rawApi.endpoint}`;
      if (!processedEndpointsInDef.has(endpointKey)) {
        validationIssues.push({
          type: "MissingApiInDefFile",
          group: groupName,
          method: rawApi.method,
          endpoint: rawApi.endpoint,
          message: `API ${rawApi.method} ${rawApi.endpoint} found in rawApiList.json but missing in ${defFileName}.`
        });
      }
    }
  }
  
  // Check for def files that have no corresponding raw APIs (orphaned def files)
  for (const defFile of apiDefFiles) {
      if (defFile.endsWith('.js')) {
          const groupNameFromDef = defFile.slice(0, -3);
          if (!groupedRawApis[groupNameFromDef]) {
              const defFilePath = join(API_DEFS_DIR, defFile);
              const defApis = await parseApiDefContent(defFilePath, groupNameFromDef);
              if (defApis.length > 0) { // Only report if the orphaned file actually defines APIs
                  validationIssues.push({
                      type: "OrphanedDefFile",
                      group: groupNameFromDef,
                      file: defFile,
                      message: `Definition file ${defFile} exists but no APIs for group '${groupNameFromDef}' found in rawApiList.json. Contains ${defApis.length} definitions.`
                  });
              }
          }
      }
  }


  if (validationIssues.length > 0) {
    console.warn(`\nValidation Issues Found (${validationIssues.length}):`);
    const issuesByType = {};
    validationIssues.forEach(issue => {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    });

    for (const type of Object.keys(issuesByType).sort()) {
        console.warn(`\n--- ${type} (${issuesByType[type].length}) ---`);
        issuesByType[type].forEach(issue => {
            let detail = `${issue.group ? '['+issue.group+'] ' : ''}${issue.method || ''} ${issue.endpoint || ''}: ${issue.message}`;
            if (issue.expected && issue.actual) {
                 if (typeof issue.expected === 'object' || typeof issue.actual === 'object') {
                    detail += `\n     Expected: ${JSON.stringify(issue.expected)}\n     Actual:   ${JSON.stringify(issue.actual)}`;
                 } else {
                    detail += ` Expected: "${issue.expected}", Actual: "${issue.actual}".`;
                 }
            }
            console.warn(detail);
        });
    }
  } else {
    console.log("\nValidation Complete. No issues found.");
  }
  console.log(`\nProcessed ${totalFilesProcessed} definition groups based on rawApiList.json.`);
}

main().catch(err => {
  console.error('[Error] Validation script execution failed:', err);
  process.exit(1);
}); 