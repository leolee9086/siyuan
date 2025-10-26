import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RAW_API_LIST_PATH = join(__dirname, 'rawApiList.json');
const API_DEFS_DIR = join(__dirname, 'apiDefs');

// Helper function to ensure a directory exists
async function ensureDirExists(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Helper function to parse apiDef content (assuming it's `export const xxx = [...]`)
async function parseApiDefContent(filePath, groupName) {
  try {
    const fileUrl = pathToFileURL(filePath).href;
    // Append cache-busting query param to ensure fresh import
    const module = await import(fileUrl + '?cacheBust=' + Date.now());
    const variableName = `${groupName}ApiDefs`;
    if (module && module[variableName] && Array.isArray(module[variableName])) {
      return module[variableName];
    }
    // console.warn(`Warning: Exported variable '${variableName}' not found or not an array in ${filePath}. Proceeding with empty definitions for this file.`);
    return []; // It's fine if the variable is not found, means it's an empty or new def file for this group
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      // console.warn(`Definition file ${filePath} not found. Will proceed as if it's a new group.`);
      return []; // It's fine if the file doesn't exist yet, means it's a new group.
    }
    // Log other errors but still return empty to allow script to continue for other files.
    console.warn(`Failed to import module from ${filePath}: ${error.message}. Proceeding with empty definitions.`);
    return [];
  }
}

// Helper function to stringify apiDef content for writing
function stringifyApiDefContent(variableName, apiArray) {
  const apiStrings = apiArray.map(apiDef => {
    const props = Object.entries(apiDef).map(([key, value]) => {
      let serializedValue;
      if (value === undefined) {
        // Explicitly write undefined for zh_cn, otherwise omit the field
        if (key === 'zh_cn') {
          serializedValue = 'undefined';
        } else {
          return null; // Omit other undefined fields like deprecated:false, or empty otherAuthChecks
        }
      } else if (typeof value === 'string') {
        // If it's one of our Zod schema placeholders (string form of a function)
        if ((key === 'zodRequestSchema' || key === 'zodResponseSchema') && (value.startsWith('(z) =>') || value.startsWith('async (z) =>'))) {
          serializedValue = value; // It's already a string representation of a function
        } else {
          // Standard string quoting, escape backslashes and double quotes
          serializedValue = `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; 
        }
      } else if (typeof value === 'function') {
        serializedValue = value.toString(); // Convert actual function to its string representation
      } else if (typeof value === 'boolean') {
        serializedValue = String(value);
      } else { // For arrays, numbers, other objects (like otherAuthChecks)
        // Use 2-space indent for JSON.stringify on arrays/objects for better readability of otherAuthChecks
        serializedValue = JSON.stringify(value, null, 2); 
      }
      return `    ${key}: ${serializedValue}`; 
    }).filter(prop => prop !== null); // Filter out explicitly omitted properties
    
    // Ensure a comma is added if there are properties and the next one isn't a closing brace
    return `  {
${props.join(',\n')}
  }`;
  });
  return `export const ${variableName} = [\n${apiStrings.join(',\n')}\n];\n`;
}

async function main() {
  await ensureDirExists(API_DEFS_DIR);

  let rawApiList;
  try {
    const rawApiContent = await readFile(RAW_API_LIST_PATH, 'utf8');
    rawApiList = JSON.parse(rawApiContent);
  } catch (error) {
    console.error(`Failed to read or parse ${RAW_API_LIST_PATH}:`, error);
    process.exit(1);
  }

  const groupedRawApis = {};
  for (const rawApi of rawApiList) {
    const parts = rawApi.endpoint.split('/');
    const groupName = (parts.length > 2 && parts[1] === 'api') ? parts[2] : 'misc';
    if (!groupedRawApis[groupName]) groupedRawApis[groupName] = [];
    groupedRawApis[groupName].push(rawApi);
  }

  let totalNewApis = 0, totalUpdatedEn = 0, totalUpdatedAuth = 0, totalDeprecated = 0, totalFilesProcessed = 0, totalZhCnUpdated = 0;

  for (const groupName of Object.keys(groupedRawApis)) {
    totalFilesProcessed++;
    const defFileName = `${groupName}.js`;
    const defFilePath = join(API_DEFS_DIR, defFileName);
    const variableName = `${groupName}ApiDefs`;
    let existingDefApis = await parseApiDefContent(defFilePath, groupName);

    const currentRawApis = groupedRawApis[groupName];
    const finalDefApis = [];
    let newApisCount = 0;
    let updatedEnCount = 0;
    let updatedAuthFlagCount = 0;
    let updatedZhCnCount = 0; // Count zh_cn updates if we decide to merge them from raw too

    const defaultZodFuncString = '(z) => ({})';
    const oldDefaultZodFuncStringForComparison = '(z) => z.any()'; // Added for comparison
    const normalize = (str) => str.replace(/\s+/g, ''); // Added helper for robust comparison

    for (const rawApi of currentRawApis) {
      const existingApi = existingDefApis.find(def => def.method === rawApi.method && def.endpoint === rawApi.endpoint);
      
      const newApiData = {
        method: rawApi.method,
        endpoint: rawApi.endpoint,
        en: rawApi.en,
        zh_cn: existingApi ? existingApi.zh_cn : undefined, // Keep manually maintained zh_cn
        needAuth: rawApi.needAuth || false,
        needAdminRole: rawApi.needAdminRole || false,
        unavailableIfReadonly: rawApi.unavailableIfReadonly || false,
        otherAuthChecks: rawApi.otherAuthChecks && rawApi.otherAuthChecks.length > 0 ? rawApi.otherAuthChecks : undefined,
        zodRequestSchema: (() => {
          if (existingApi && existingApi.zodRequestSchema) {
            const currentSchemaValue = existingApi.zodRequestSchema;
            let currentSchemaStringForComparison;
            if (typeof currentSchemaValue === 'function') {
              currentSchemaStringForComparison = currentSchemaValue.toString();
            } else if (typeof currentSchemaValue === 'string') {
              currentSchemaStringForComparison = currentSchemaValue;
            } else {
              currentSchemaStringForComparison = ""; 
            }
            if (normalize(currentSchemaStringForComparison) === normalize(oldDefaultZodFuncStringForComparison)) {
              return defaultZodFuncString; // Replace old default
            }
            return currentSchemaValue; // Keep custom or already new default
          }
          return defaultZodFuncString; // New API or no schema before
        })(),
        zodResponseSchema: (() => {
          if (existingApi && existingApi.zodResponseSchema) {
            const currentSchemaValue = existingApi.zodResponseSchema;
            let currentSchemaStringForComparison;
            if (typeof currentSchemaValue === 'function') {
              currentSchemaStringForComparison = currentSchemaValue.toString();
            } else if (typeof currentSchemaValue === 'string') {
              currentSchemaStringForComparison = currentSchemaValue;
            } else {
              currentSchemaStringForComparison = "";
            }
            if (normalize(currentSchemaStringForComparison) === normalize(oldDefaultZodFuncStringForComparison)) {
              return defaultZodFuncString; // Replace old default
            }
            return currentSchemaValue; // Keep custom or already new default
          }
          return defaultZodFuncString; // New API or no schema before
        })(),
      };

      if (existingApi) {
        const mergedApi = { ...existingApi, ...newApiData }; 
        
        if (existingApi.en !== newApiData.en) {
          // console.log(`Updating EN for ${newApiData.method} ${newApiData.endpoint}: "${existingApi.en}" -> "${newApiData.en}"`);
          updatedEnCount++;
        }
        if ((existingApi.needAuth || false) !== newApiData.needAuth || 
            (existingApi.needAdminRole || false) !== newApiData.needAdminRole || 
            (existingApi.unavailableIfReadonly || false) !== newApiData.unavailableIfReadonly ||
            JSON.stringify((existingApi.otherAuthChecks || []).sort()) !== JSON.stringify((newApiData.otherAuthChecks || []).sort())) {
          updatedAuthFlagCount++;
        }
        // If zh_cn was undefined and rawApi has it, it won't be updated by newApiData logic currently.
        // This is intended, as zh_cn is manually maintained or restored by another script.
        finalDefApis.push(mergedApi);
      } else {
        newApisCount++;
        finalDefApis.push(newApiData); 
      }
    }

    let deprecatedCountInLoop = 0;
    existingDefApis.forEach(defApi => {
      const stillExistsInRaw = currentRawApis.some(raw => raw.method === defApi.method && raw.endpoint === defApi.endpoint);
      if (!stillExistsInRaw) {
        let finalVersion = finalDefApis.find(f => f.method === defApi.method && f.endpoint === defApi.endpoint);
        if (finalVersion) {
          if (finalVersion.deprecated !== true) deprecatedCountInLoop++;
          finalVersion.deprecated = true;
        } else {
          deprecatedCountInLoop++;
          const deprecatedApi = { 
            ...defApi, 
            deprecated: true,
            // Ensure Zod schemas for deprecated APIs if they were somehow missing
            zodRequestSchema: defApi.zodRequestSchema || defaultZodFuncString,
            zodResponseSchema: defApi.zodResponseSchema || defaultZodFuncString,
          };
          finalDefApis.push(deprecatedApi);
        }
      }
    });
    
    finalDefApis.forEach(api => {
        const isInRaw = currentRawApis.some(raw => raw.method === api.method && raw.endpoint === api.endpoint);
        if (isInRaw) {
            delete api.deprecated; 
        } else if (api.deprecated !== true) {
            // This means it was an existing API not in raw, and somehow missed deprecation marking.
            // console.warn(`API ${api.method} ${api.endpoint} in ${groupName}.js should be deprecated but isn't.`);
            api.deprecated = true; // Ensure it's marked
        }
        
        api.needAuth = api.needAuth || false;
        api.needAdminRole = api.needAdminRole || false;
        api.unavailableIfReadonly = api.unavailableIfReadonly || false;
        if (!api.otherAuthChecks || api.otherAuthChecks.length === 0) {
            delete api.otherAuthChecks;
        }
        api.zodRequestSchema = api.zodRequestSchema || defaultZodFuncString;
        api.zodResponseSchema = api.zodResponseSchema || defaultZodFuncString;
        
        if (api.deprecated === false) { // Only delete if explicitly false, not undefined
            delete api.deprecated;
        }
    });

    if (finalDefApis.length > 0) {
      finalDefApis.sort((a, b) => {
        if (a.endpoint < b.endpoint) return -1; if (a.endpoint > b.endpoint) return 1;
        if (a.method < b.method) return -1; if (a.method > b.method) return 1;
        return 0;
      });
      const newFileContent = stringifyApiDefContent(variableName, finalDefApis);
      await writeFile(defFilePath, newFileContent, 'utf8');
      console.log(`Processed ${groupName}.js: New: ${newApisCount}, Updated EN: ${updatedEnCount}, Updated Auth: ${updatedAuthFlagCount}, Deprecated: ${deprecatedCountInLoop}. Total APIs: ${finalDefApis.length}`);
      totalNewApis += newApisCount;
      totalUpdatedEn += updatedEnCount;
      totalUpdatedAuth += updatedAuthFlagCount;
      totalDeprecated += deprecatedCountInLoop;
    } else if (existingDefApis.length > 0) {
        await writeFile(defFilePath, `export const ${variableName} = [];\n`, 'utf8');
        console.log(`Emptied ${groupName}.js as all its APIs were removed or deprecated. Original: ${existingDefApis.length}`);
        totalDeprecated += existingDefApis.length;
    }
  }
  console.log(`\nMerge process complete. Processed ${totalFilesProcessed} definition files.
Total New APIs: ${totalNewApis}, Total EN Updated: ${totalUpdatedEn}, Total Auth Updated: ${totalUpdatedAuth}, Total Deprecated: ${totalDeprecated}.
`);
}

main().catch(err => {
  console.error('Merge script execution failed:', err);
  process.exit(1);
});
