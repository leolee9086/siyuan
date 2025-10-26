const fs = require('fs').promises;
const path = require('path');
const { pathToFileURL } = require('url');
const z = require('zod');

const API_DEFS_DIR = path.join(__dirname, 'apiDefs');
const OUTPUT_CLIENT_DIR = path.join(__dirname, 'client');
const OUTPUT_DTS_FILE = path.join(OUTPUT_CLIENT_DIR, 'index.d.ts');
const OUTPUT_CLIENT_INDEX_JS_PATH = path.join(OUTPUT_CLIENT_DIR, 'index.js');

const GENERATED_TYPES = {};
const collectedApiGroups = [];

// Helper to check if an object is a Zod schema (ZodRawShape)
const isZodRawShape = (obj) => {
    if (typeof obj !== "object" || obj === null) return false;
    if (Object.keys(obj).length === 0) return false; // Empty object is not a raw shape with Zod types
    // Check that at least one property is a ZodType instance
    return Object.values(obj).some(v => v?._def?.typeName);
};

function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getApiNameFromDef(apiDef) {
    return apiDef.en || apiDef.endpoint.split('/').pop().replace(/-/g, '_');
}

function parseZodSchemaDef(schemaDef, baseTypeNameForTs, lazyBeingProcessed) {
    let currentDef = schemaDef;
    let isOptional = false;
    let isNullable = false;
    let generatedInterfaceName = null;

    while (
        currentDef.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
        currentDef.typeName === z.ZodFirstPartyTypeKind.ZodNullable ||
        currentDef.typeName === z.ZodFirstPartyTypeKind.ZodDefault
    ) {
        if (currentDef.typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
            isOptional = true;
        } else if (currentDef.typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
            isNullable = true;
        }
        
        if (currentDef.innerType && currentDef.innerType._def) {
             currentDef = currentDef.innerType._def;
        } else {
            console.warn(`[parseZodSchemaDef] Encountered ${currentDef.typeName} without a valid innerType._def for ${baseTypeNameForTs}`);
            break; 
        }
    }
    const mainDef = currentDef;
    const description = mainDef.description || '';
    let jsDocType = 'any';
    let tsType = 'any';
    let properties = null;
    let itemType = null;
    let enumValues = null;
    let unionOptions = null;
    let literalValue = null;
    let recordKeyType = null;
    let recordValueType = null;

    switch (mainDef.typeName) {
        case z.ZodFirstPartyTypeKind.ZodString:
            jsDocType = 'string'; tsType = 'string';
            break;
        case z.ZodFirstPartyTypeKind.ZodNumber:
            jsDocType = 'number'; tsType = 'number';
            break;
        case z.ZodFirstPartyTypeKind.ZodBoolean:
            jsDocType = 'boolean'; tsType = 'boolean';
            break;
        case z.ZodFirstPartyTypeKind.ZodAny:
            jsDocType = 'any'; tsType = 'any';
            break;
        case z.ZodFirstPartyTypeKind.ZodNull:
            jsDocType = 'null'; tsType = 'null';
            break;
        case z.ZodFirstPartyTypeKind.ZodUnknown:
            jsDocType = 'unknown'; tsType = 'unknown';
            break;
        case z.ZodFirstPartyTypeKind.ZodVoid:
            jsDocType = 'void'; tsType = 'void';
            if (mainDef.shape && Object.keys(mainDef.shape()).length === 0) {
                jsDocType = 'object'; tsType = 'Record<string, never>';
            }
            break;
        case z.ZodFirstPartyTypeKind.ZodArray:
            itemType = parseZodSchemaDef(mainDef.type._def, `${baseTypeNameForTs}Item`, lazyBeingProcessed);
            jsDocType = `Array<${itemType.jsDocType.split(' ')[0].replace('?', '')}>`;
            tsType = `Array<${itemType.tsType}>`;
            break;
        case z.ZodFirstPartyTypeKind.ZodObject:
            jsDocType = 'object';
            properties = {};
            const shape = mainDef.shape();
            if (Object.keys(shape).length === 0) {
                tsType = 'Record<string, never>';
                jsDocType = 'object'; // or Record<string, never> for JSDoc too?
            } else {
                for (const key in shape) {
                    properties[key] = parseZodSchemaDef(shape[key]._def, `${baseTypeNameForTs}${capitalizeFirstLetter(key)}`, lazyBeingProcessed);
                }
                if (baseTypeNameForTs && !GENERATED_TYPES[baseTypeNameForTs]) {
                    let tsProps = '';
                    for (const key in properties) {
                        const propInfo = properties[key];
                        const optMarker = propInfo.isOptional ? '?' : '';
                        const descComment = propInfo.description ? ` // ${propInfo.description.replace(/\r\n|\r|\n/g, ' ')}` : '';
                        const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
                        tsProps += `  ${propName}${optMarker}: ${propInfo.tsType};${descComment}\n`;
                    }
                    if (mainDef.catchall && mainDef.catchall._def.typeName !== z.ZodFirstPartyTypeKind.ZodNever) {
                        const catchallTypeInfo = parseZodSchemaDef(mainDef.catchall._def, `${baseTypeNameForTs}Catchall`, lazyBeingProcessed);
                        tsProps += `  [key: string]: ${catchallTypeInfo.tsType}; // From .catchall()\n`;
                    }
                    GENERATED_TYPES[baseTypeNameForTs] = `interface ${baseTypeNameForTs} {\n${tsProps}}`;
                    tsType = baseTypeNameForTs;
                    jsDocType = baseTypeNameForTs; // Ensure JSDoc type also uses the interface name
                    generatedInterfaceName = baseTypeNameForTs;
                } else if (baseTypeNameForTs && GENERATED_TYPES[baseTypeNameForTs]) {
                    tsType = baseTypeNameForTs;
                    jsDocType = baseTypeNameForTs; // Ensure JSDoc type also uses the interface name
                    generatedInterfaceName = baseTypeNameForTs;
                } else {
                    let inlineProps = '';
                    for (const key in properties) {
                        const propInfo = properties[key];
                        const optMarker = propInfo.isOptional ? '?' : '';
                        const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
                        inlineProps += `  ${propName}${optMarker}: ${propInfo.tsType};\n`;
                    }
                    if (mainDef.catchall && mainDef.catchall._def.typeName !== z.ZodFirstPartyTypeKind.ZodNever) {
                        const catchallTypeInfo = parseZodSchemaDef(mainDef.catchall._def, `${baseTypeNameForTs}Catchall`, lazyBeingProcessed);
                        inlineProps += `  [key: string]: ${catchallTypeInfo.tsType};\n`;
                    }
                    tsType = `{\n${inlineProps}}`;
                    jsDocType = 'object'; // For inline objects, JSDoc type remains generic 'object'
                }
            }
            break;
        case z.ZodFirstPartyTypeKind.ZodEnum:
            enumValues = mainDef.values;
            jsDocType = enumValues.map(v => typeof v === 'string' ? `'${v}'` : v).join(' | ');
            tsType = jsDocType;
            break;
        case z.ZodFirstPartyTypeKind.ZodUnion:
            unionOptions = mainDef.options.map((optSchema, i) =>
                parseZodSchemaDef(optSchema._def, `${baseTypeNameForTs}Option${i}`, lazyBeingProcessed)
            );
            jsDocType = unionOptions.map(opt => opt.jsDocType.split(' ')[0]).join(' | ');
            tsType = unionOptions.map(opt => opt.tsType).join(' | ');
            break;
        case z.ZodFirstPartyTypeKind.ZodLiteral:
            literalValue = mainDef.value;
            jsDocType = typeof literalValue === 'string' ? `'${literalValue}'` : String(literalValue);
            tsType = jsDocType;
            break;
        case z.ZodFirstPartyTypeKind.ZodRecord:
            recordKeyType = parseZodSchemaDef(mainDef.keyType._def, `${baseTypeNameForTs}Key`, lazyBeingProcessed);
            recordValueType = parseZodSchemaDef(mainDef.valueType._def, `${baseTypeNameForTs}Value`, lazyBeingProcessed);
            
            let keyJsDocPart = recordKeyType.jsDocType.split(' ')[0].trim();
            let valueJsDocPart = recordValueType.jsDocType.split(' ')[0].trim();
            console.log(`[DEBUG ZodRecord] baseTypeNameForTs: ${baseTypeNameForTs}, keyJsDocPart: '${keyJsDocPart}', valueJsDocPart: '${valueJsDocPart}'`); // <--- 添加这行
            // If valueJsDocPart is an empty string after trimming, or if it's 'any',
            // then the record's value type for JSDoc should be 'any'.
            if (!valueJsDocPart || valueJsDocPart === 'any') {
                jsDocType = `Record<${keyJsDocPart}, any>`;
            } else {
                jsDocType = `Record<${keyJsDocPart}, ${valueJsDocPart}>`;
            }

            tsType = `Record<${recordKeyType.tsType}, ${recordValueType.tsType}>`;
            break;
        case z.ZodFirstPartyTypeKind.ZodLazy:
            // Check if this lazy definition is already being processed to prevent infinite recursion
            if (lazyBeingProcessed.has(mainDef)) {
                tsType = lazyBeingProcessed.get(mainDef);
                jsDocType = tsType; // Use the already determined type name
                // No need to set GENERATED_TYPES here, it's either already set or will be by the initial call
                break; // Break early, type is already being handled
            }

            // If a named type is expected for this lazy schema, and it's already fully generated, use it.
            // This handles cases where a lazy type might be referenced multiple times after its definition is complete.
            if (baseTypeNameForTs && GENERATED_TYPES[baseTypeNameForTs] && !GENERATED_TYPES[baseTypeNameForTs].startsWith('// Recursive type')) {
                tsType = baseTypeNameForTs;
                jsDocType = baseTypeNameForTs;
            } else {
                const getter = mainDef.getter;
                if (typeof getter === 'function') {
                    lazyBeingProcessed.set(mainDef, baseTypeNameForTs); // Mark as being processed

                    const internalSchema = getter();
                    if (internalSchema && internalSchema._def) {
                        if (baseTypeNameForTs && !GENERATED_TYPES[baseTypeNameForTs]) {
                            // Set a placeholder only if a named type is expected and not yet in GENERATED_TYPES
                            GENERATED_TYPES[baseTypeNameForTs] = `// Recursive type ${baseTypeNameForTs} (processing)`;
                        }

                        const internalTypeInfo = parseZodSchemaDef(internalSchema._def, baseTypeNameForTs, lazyBeingProcessed);
                        tsType = internalTypeInfo.tsType;
                        jsDocType = internalTypeInfo.jsDocType;

                        // If the recursive call (parseZodSchemaDef above) resulted in generating an interface 
                        // with baseTypeNameForTs, it would have updated GENERATED_TYPES[baseTypeNameForTs].
                        // If the placeholder is still there, it means the internal type resolved to something else
                        // (e.g. an array of the named type, or a primitive), or the named type itself if it's an object.
                        // If tsType IS baseTypeNameForTs, it means an interface was likely generated.
                        // If tsType is DIFFERENT, and the placeholder for an object was set,
                        // we need to ensure the placeholder is cleaned up if the object wasn't generated under that name.
                        if (baseTypeNameForTs &&
                            GENERATED_TYPES[baseTypeNameForTs] &&
                            GENERATED_TYPES[baseTypeNameForTs].startsWith('// Recursive type') &&
                            tsType !== baseTypeNameForTs && // Critical: only delete if internal type didn't resolve to the named object
                            !GENERATED_TYPES[baseTypeNameForTs].includes(`interface ${baseTypeNameForTs}`)) { // Ensure an interface wasn't actually generated
                            delete GENERATED_TYPES[baseTypeNameForTs];
                        }
                    } else {
                        console.warn(`[parseZodSchemaDef] ZodLazy for ${baseTypeNameForTs} has a getter that did not return a valid schema.`);
                        tsType = 'any'; jsDocType = 'any';
                        if (baseTypeNameForTs && GENERATED_TYPES[baseTypeNameForTs] && GENERATED_TYPES[baseTypeNameForTs].startsWith('// Recursive type')) {
                            delete GENERATED_TYPES[baseTypeNameForTs]; // Clean up placeholder on error
                        }
                    }
                    lazyBeingProcessed.delete(mainDef); // Unmark after processing
                } else {
                    console.warn(`[parseZodSchemaDef] ZodLazy for ${baseTypeNameForTs} has no getter function.`);
                    tsType = 'any'; jsDocType = 'any';
                    if (baseTypeNameForTs && GENERATED_TYPES[baseTypeNameForTs] && GENERATED_TYPES[baseTypeNameForTs].startsWith('// Recursive type')) {
                        delete GENERATED_TYPES[baseTypeNameForTs]; // Clean up placeholder on error
                    }
                }
            }
            break;
        default:
            console.warn(`[parseZodSchemaDef] Unhandled Zod type: ${mainDef.typeName} for ${baseTypeNameForTs}`);
            jsDocType = 'any'; tsType = 'any';
    }

    return {
        typeName: mainDef.typeName,
        description: description,
        isOptional: isOptional,
        isNullable: isNullable,
        jsDocType: `${jsDocType}${isNullable ? ' | null' : ''}`,
        tsType: `${tsType}${isNullable ? ' | null' : ''}`,
        properties: properties,
        itemType: itemType,
        enumValues: enumValues,
        unionOptions: unionOptions,
        literalValue: literalValue,
        recordKeyType: recordKeyType,
        recordValueType: recordValueType,
        generatedInterfaceName: generatedInterfaceName
    };
}

function parseSchema(schemaFn, apiNameForContext, baseTypeNameForTs, lazyBeingProcessed) {
    if (typeof schemaFn !== 'function') {
        // Handle cases where schemaFn is not a function (e.g., a direct object or Zod instance)
        if (schemaFn && typeof schemaFn === 'object') {
            if (schemaFn._def && schemaFn._def.typeName === z.ZodFirstPartyTypeKind.ZodObject) {
                console.error(`[parseSchema] ERROR: Schema for ${apiNameForContext} was a direct z.object() instance. It should be a raw shape or a function returning one. Please fix the API definition.`);
                return parseZodSchemaDef(z.any().describe(`ERROR: API def ${apiNameForContext} is a direct z.object() instance.`)._def, baseTypeNameForTs, lazyBeingProcessed);
            } else if (isZodRawShape(schemaFn)) {
                try {
                    const zodSchemaInstance = z.object(schemaFn);
                    return parseZodSchemaDef(zodSchemaInstance._def, baseTypeNameForTs, lazyBeingProcessed);
                } catch (e) {
                    console.error(`[parseSchema] Error wrapping raw shape object for ${apiNameForContext} with z.object(): ${e.message}.`);
                    return parseZodSchemaDef(z.any().describe(`Error in raw shape: ${e.message}`)._def, baseTypeNameForTs, lazyBeingProcessed);
                }
            } else if (schemaFn._def && schemaFn._def.typeName) { // Other Zod type instance
                 return parseZodSchemaDef(schemaFn._def, baseTypeNameForTs, lazyBeingProcessed);
            } else if (Object.keys(schemaFn).length === 0) { // Empty object {}
                 return parseZodSchemaDef(z.object({})._def, baseTypeNameForTs, lazyBeingProcessed);
            }
        }
        console.warn(`[parseSchema] Schema for ${apiNameForContext} is not a function and not a recognized schema object/instance. Defaulting to z.any().`);
        return parseZodSchemaDef(z.any().describe('Schema was not a function or recognized object/instance')._def, baseTypeNameForTs, lazyBeingProcessed);
    }

    // schemaFn IS a function
    try {
        const returnedValue = schemaFn(z);

        if (returnedValue && returnedValue._def && returnedValue._def.typeName === z.ZodFirstPartyTypeKind.ZodObject) {
            console.error(`[parseSchema] ERROR: Schema function for ${apiNameForContext} directly returned a z.object() instance. It should return a raw shape (e.g., { key: z.string() }). Please fix the API definition.`);
            return parseZodSchemaDef(z.any().describe(`ERROR: API def ${apiNameForContext} returns z.object() directly.`)._def, baseTypeNameForTs, lazyBeingProcessed);
        } else if (isZodRawShape(returnedValue)) {
            try {
                const zodSchemaInstance = z.object(returnedValue);
                return parseZodSchemaDef(zodSchemaInstance._def, baseTypeNameForTs, lazyBeingProcessed);
            } catch (e) {
                 console.error(`[parseSchema] Error wrapping raw shape from function for ${apiNameForContext} with z.object(): ${e.message}.`);
                 return parseZodSchemaDef(z.any().describe(`Error wrapping raw shape: ${e.message}`)._def, baseTypeNameForTs, lazyBeingProcessed);
            }
        } else if (returnedValue && returnedValue._def && returnedValue._def.typeName) {
            // schemaFn returned another Zod type (e.g., z.string, z.array, z.lazy, z.void)
            return parseZodSchemaDef(returnedValue._def, baseTypeNameForTs, lazyBeingProcessed);
        } else if (returnedValue && typeof returnedValue === 'object' && Object.keys(returnedValue).length === 0) {
            // schemaFn returned an empty object {} -> treat as z.object({})
            return parseZodSchemaDef(z.object({})._def, baseTypeNameForTs, lazyBeingProcessed);
        } else {
            // This handles cases like `() => z.void()` if we consider z.void() without _def or other direct Zod types without _def (though unlikely with zod v3)
            // More likely: returnedValue is undefined, null, or a primitive, or an object not recognizable
            if (returnedValue && returnedValue.constructor && returnedValue.constructor.name === 'ZodVoid') { // Special check for ZodVoid if it doesn't always have a typical _def
                 return parseZodSchemaDef(z.void()._def, baseTypeNameForTs, lazyBeingProcessed); // Ensure we process it as a ZodVoid type
            }
            console.error(`[parseSchema] Schema function for ${apiNameForContext} did not return a Zod schema, a raw shape, or an empty object. Returned: ${JSON.stringify(returnedValue)}. Defaulting to z.any().`);
            return parseZodSchemaDef(z.any().describe('Invalid schema from function')._def, baseTypeNameForTs, lazyBeingProcessed);
        }
    } catch (e) {
        console.error(`[parseSchema] Error executing schema function for ${apiNameForContext}: ${e.message}. Defaulting to z.any().`);
        if (e.stack) console.error(e.stack);
        return parseZodSchemaDef(z.any().describe(`Error in schema function: ${e.message}`)._def, baseTypeNameForTs, lazyBeingProcessed);
    }
}

function generateJsDocPropertiesForObject(properties, baseParamName, forReturn = false, indent = ' * ', collectedTypedefs = new Set()) {
    let propLines = [];
    if (!properties) return propLines;

    for (const key in properties) {
        const propInfo = properties[key];
        let actualType = propInfo.jsDocType;
        if (actualType.endsWith(' | null')) {
            actualType = actualType.substring(0, actualType.length - ' | null'.length).trim();
        }
        if (!actualType) actualType = 'any';

        const description = propInfo.description || key;
        const typeForJsDoc = propInfo.generatedInterfaceName || actualType.replace('?', '');

        // If this property's type is a generated interface, add it to typedefs
        if (propInfo.generatedInterfaceName) {
            collectedTypedefs.add(` * @typedef {import('./index.d.ts').${propInfo.generatedInterfaceName}} ${propInfo.generatedInterfaceName}`);
        }

        if (forReturn) {
            // For @property, if it's a top-level named interface, we skip, handled by @returns {Promise<InterfaceName>}
            // Otherwise, or if nested, generate @property.
            if (baseParamName === '' && propInfo.generatedInterfaceName) {
                // Skip, top-level return object properties are not listed if return is a named interface
            } else {
                const optionalMarker = propInfo.isOptional ? '?' : '';
                propLines.push(`${indent}@property {${typeForJsDoc}} ${key}${optionalMarker} ${description}`);
            }
        } else {
            const paramOptionalSyntax = propInfo.isOptional ? `[${baseParamName}.${key}]` : `${baseParamName}.${key}`;
            propLines.push(`${indent}@param {${typeForJsDoc}} ${paramOptionalSyntax} ${description}`);
        }

        // Recurse for ZodObject properties only if they did NOT result in a generated interface name for themselves.
        // If they did, their structure is defined by the @typedef and TS interface.
        if (propInfo.typeName === z.ZodFirstPartyTypeKind.ZodObject && propInfo.properties && !propInfo.generatedInterfaceName) {
            propLines = propLines.concat(generateJsDocPropertiesForObject(propInfo.properties, `${baseParamName}.${key}`, forReturn, indent, collectedTypedefs));
        }
    }
    return propLines;
}

async function generateClient() {
    const lazyBeingProcessed = new Map();
    try {
        await fs.mkdir(OUTPUT_CLIENT_DIR, { recursive: true });
    } catch (e) { /* ignore if exists */ }

    const apiDefFiles = (await fs.readdir(API_DEFS_DIR)).filter(f => f.endsWith('.js') && !f.startsWith('AInote') && !f.startsWith('validateApiDefs'));
    let allGroupApiInterfacesDts = '';

    for (const key in GENERATED_TYPES) {
        delete GENERATED_TYPES[key];
    }
    collectedApiGroups.length = 0;

    for (const defFile of apiDefFiles) {
        const groupName = defFile.replace('.js', '');
        const groupClassName = `${capitalizeFirstLetter(groupName)}Api`;
        let groupInstanceName = groupName.includes('-') 
            ? groupName.toLowerCase().replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())
            : (groupName.charAt(0).toLowerCase() + groupName.slice(1));
        if (groupInstanceName === "export") groupInstanceName = "_export";

        collectedApiGroups.push({ groupName, groupClassName, groupInstanceName });

        const defFilePath = path.join(API_DEFS_DIR, defFile);
        const fileUrl = pathToFileURL(defFilePath).href + '?t=' + Date.now();

        let apiDefsInFile;
        try {
            const module = await import(fileUrl);
            const variableName = `${groupName}ApiDefs`;
            apiDefsInFile = module[variableName];
            if (!Array.isArray(apiDefsInFile)) {
                console.warn(`[Warning] ${variableName} in ${defFile} is not an array. Skipping.`);
                continue;
            }
        } catch (error) {
            console.error(`[Error] Failed to import API definitions from ${defFile}: ${error.message}`);
            console.error(error.stack);
            continue;
        }

        let jsClassMethodsForGroup = '';
        let tsGroupInterfaceMethods = '';

        for (const apiDef of apiDefsInFile) {
            const apiName = getApiNameFromDef(apiDef);
            if (!apiName) {
                console.warn(`[Warning] Could not determine API name for endpoint ${apiDef.endpoint} in group ${groupName}. Skipping.`);
                continue;
            }

            const apiNameForContext = `${capitalizeFirstLetter(groupName)}${capitalizeFirstLetter(apiName)}`;
            const reqInterfaceName = `${apiNameForContext}Params`;
            const resInterfaceName = `${apiNameForContext}Response`;
            
            lazyBeingProcessed.clear();
            const parsedReqInfo = parseSchema(apiDef.zodRequestSchema, `${apiNameForContext} Request`, reqInterfaceName, lazyBeingProcessed);
            lazyBeingProcessed.clear();
            const parsedResInfo = parseSchema(apiDef.zodResponseSchema, `${apiNameForContext} Response`, resInterfaceName, lazyBeingProcessed);

            const collectedTypedefs = new Set();

            let jsDoc = '/**\n';

            // Add typedef for request if it's a named interface
            if (parsedReqInfo.generatedInterfaceName) {
                 collectedTypedefs.add(` * @typedef {import('./index.d.ts').${parsedReqInfo.generatedInterfaceName}} ${parsedReqInfo.generatedInterfaceName}`);
            }
            // Add typedef for response if it's a named interface
            if (parsedResInfo.generatedInterfaceName) {
                 collectedTypedefs.add(` * @typedef {import('./index.d.ts').${parsedResInfo.generatedInterfaceName}} ${parsedResInfo.generatedInterfaceName}`);
            }

            // Collect typedefs from nested properties (for params only, return properties are not expanded if return is an interface)
            if (parsedReqInfo.properties && !parsedReqInfo.generatedInterfaceName) { // If request is an inline object
                generateJsDocPropertiesForObject(parsedReqInfo.properties, 'params', false, ' * ', collectedTypedefs);
            } else if (parsedReqInfo.properties && parsedReqInfo.generatedInterfaceName) { // If request is a named interface, still scan its props for further typedefs
                 generateJsDocPropertiesForObject(parsedReqInfo.properties, 'params', false, ' * ', collectedTypedefs); 
            }

            if (parsedResInfo.properties && !parsedResInfo.generatedInterfaceName) { // If response is an inline object, scan its props for typedefs
                generateJsDocPropertiesForObject(parsedResInfo.properties, '', true, ' * ', collectedTypedefs);
            }
            
            if (collectedTypedefs.size > 0) {
                jsDoc += Array.from(collectedTypedefs).join('\n') + '\n';
            }

            jsDoc += ` * ${apiDef.description || apiName}\n`;
            let authNotes = [];
            if (apiDef.needAuth) authNotes.push('Requires authentication');
            if (apiDef.needAdminRole) authNotes.push('Requires admin role');
            if (apiDef.unavailableIfReadonly) authNotes.push('Unavailable in read-only mode');
            if (authNotes.length > 0) jsDoc += ` * (${authNotes.join(', ')})\n`;
            if (apiDef.deprecated) jsDoc += ` * @deprecated\n`;

            let hasRequestPayload = parsedReqInfo.typeName !== z.ZodFirstPartyTypeKind.ZodVoid &&
                                !(parsedReqInfo.typeName === z.ZodFirstPartyTypeKind.ZodObject && (!parsedReqInfo.properties || Object.keys(parsedReqInfo.properties).length === 0));
            
            const jsDocLines = [];
            let paramsArgumentNameForJs = '';
            let paramsArgumentForFetcher = 'undefined';

            if (hasRequestPayload) {
                if (parsedReqInfo.typeName === z.ZodFirstPartyTypeKind.ZodObject && parsedReqInfo.properties && Object.keys(parsedReqInfo.properties).length > 0) {
                    paramsArgumentNameForJs = 'params';
                    const paramTypeName = parsedReqInfo.generatedInterfaceName || 'object';
                    jsDocLines.push(` * @param {${paramTypeName}} params - Request parameters.`);
                    if (!parsedReqInfo.generatedInterfaceName) { // Only add sub-properties if not a named interface
                        jsDocLines.push(...generateJsDocPropertiesForObject(parsedReqInfo.properties, 'params', false, ' * ', new Set())); // Pass new Set to avoid re-adding typedefs here
                    }
                    paramsArgumentForFetcher = 'params';
                } else {
                    paramsArgumentNameForJs = 'payload';
                    const paramTypeBase = parsedReqInfo.jsDocType.split(' ')[0];
                    jsDocLines.push(` * @param {${paramTypeBase}} payload ${parsedReqInfo.description ? '- ' + parsedReqInfo.description : ''}`);
                    paramsArgumentForFetcher = 'payload';
                }
            } else {
                 if (apiDef.method === 'POST' || apiDef.method === 'PUT') {
                    paramsArgumentForFetcher = '{}';
                }
            }
            
            const resJsDocTypeBase = parsedResInfo.generatedInterfaceName || parsedResInfo.jsDocType.split(' ')[0];
            jsDocLines.push(` * @returns {Promise<${resJsDocTypeBase}>}${parsedResInfo.description ? ' ' + parsedResInfo.description : ''}`);
            
            if(jsDocLines.length > 0) jsDoc += jsDocLines.join('\n') + '\n';
            jsDoc += ` */\n`;

            jsClassMethodsForGroup += `  ${jsDoc}`;
            jsClassMethodsForGroup += `  ${apiName}(${paramsArgumentNameForJs}) {\n`;
            jsClassMethodsForGroup += `    return this.fetcher('${apiDef.method}', '${apiDef.endpoint}', ${paramsArgumentForFetcher}, ${!!apiDef.needAuth});\n`;
            jsClassMethodsForGroup += `  }\n\n`;

            let tsReqParamType = 'void';
            let paramsArgumentNameForTs = '';

            if (hasRequestPayload) {
                 if (parsedReqInfo.typeName === z.ZodFirstPartyTypeKind.ZodObject && parsedReqInfo.properties && Object.keys(parsedReqInfo.properties).length > 0) {
                    tsReqParamType = reqInterfaceName;
                    paramsArgumentNameForTs = 'params';
                    if (GENERATED_TYPES[reqInterfaceName]) { // Check if it's a generated interface
                        // Correctly reference the interface name
                    }
                } else {
                    tsReqParamType = parsedReqInfo.tsType;
                    paramsArgumentNameForTs = 'payload';
                }
            }
            
            let tsResType = parsedResInfo.tsType;
             if (parsedResInfo.typeName === z.ZodFirstPartyTypeKind.ZodObject && (!parsedResInfo.properties || Object.keys(parsedResInfo.properties).length === 0) && tsResType !== 'Record<string, never>') {
                tsResType = 'Record<string, never>';
            } else if (tsResType === 'void' && parsedResInfo.typeName !== z.ZodFirstPartyTypeKind.ZodVoid && !(parsedResInfo.typeName === z.ZodFirstPartyTypeKind.ZodObject && (!parsedResInfo.properties || Object.keys(parsedResInfo.properties).length === 0))) {
                // This was an empty else if, removed.
            } else if (GENERATED_TYPES[resInterfaceName] && parsedResInfo.tsType === resInterfaceName) { // Check if it's a generated interface for response
                 // Correctly reference the interface name for response
            }

            const tsParamsList = [];
            if (paramsArgumentNameForTs) {
                tsParamsList.push(`${paramsArgumentNameForTs}: ${tsReqParamType}`);
            }

            tsGroupInterfaceMethods += `  /**\n`;
            tsGroupInterfaceMethods += `   * ${apiDef.description || apiName}\n`;
            if (authNotes.length > 0) tsGroupInterfaceMethods += `   * (${authNotes.join(', ')})\n`;
            if (apiDef.deprecated) tsGroupInterfaceMethods += `   * @deprecated\n`;
            if (paramsArgumentNameForTs === 'params') {
                tsGroupInterfaceMethods += `   * @param params Request parameters (${reqInterfaceName})\n`;
            } else if (paramsArgumentNameForTs === 'payload') {
                tsGroupInterfaceMethods += `   * @param payload Request payload (${tsReqParamType})\n`;
            }
            tsGroupInterfaceMethods += `   * @returns Promise<${tsResType}> ${parsedResInfo.description || ''}\n`;
            tsGroupInterfaceMethods += `   */\n`;
            tsGroupInterfaceMethods += `  ${apiName}(${tsParamsList.join(', ')}): Promise<${tsResType}>;\n\n`;
        }

        const jsClientFileContent = `// Generated API client for group ${groupName}\nexport class ${groupClassName} {\n    constructor(fetcher) {\n        this.fetcher = fetcher;\n    }\n\n${jsClassMethodsForGroup}}\n`;
        const clientModulePath = path.join(OUTPUT_CLIENT_DIR, `${groupName}.js`);
        await fs.writeFile(clientModulePath, jsClientFileContent);
        console.log(`Generated JS client class: client/${groupName}.js`);

        if (tsGroupInterfaceMethods) {
            allGroupApiInterfacesDts += `export interface ${groupClassName} {\n${tsGroupInterfaceMethods}}\n\n`;
        }
    }

    let indexJsContent = '// Main Siyuan SDK Client Entry Point\n\n';
    for (const group of collectedApiGroups) {
        indexJsContent += `import { ${group.groupClassName} } from './${group.groupName}.js';\n`;
    }
    indexJsContent += '\n';

    indexJsContent += `export class SiyuanClient {\n`;
    indexJsContent += `    constructor({ baseUrl = 'http://127.0.0.1:6806', apiToken = '', customFetch } = {}) {\n`;
    indexJsContent += `        this.baseUrl = baseUrl.replace(/$/, ''); // Ensure no trailing slash\n`;
    indexJsContent += `        this.apiToken = apiToken;\n`;
    indexJsContent += `        this.fetchInstance = customFetch || (typeof window !== 'undefined' ? window.fetch.bind(window) : global.fetch);\n`;
    indexJsContent += `    }\n\n`;

    indexJsContent += `    async fetcher(method, endpoint, params, needAuth) {\n`;
    indexJsContent += `        let actualUrl = this.baseUrl + endpoint;\n`;
    indexJsContent += `        const options = { method, headers: {} };\n\n`;
    indexJsContent += `        if (needAuth && this.apiToken) {\n`;
    indexJsContent += `            options.headers['Authorization'] = \`Token \${this.apiToken}\`; \n`;
    indexJsContent += `        }\n\n`;
    indexJsContent += `        if (method === 'POST' || method === 'PUT') {\n`;
    indexJsContent += `            options.headers['Content-Type'] = 'application/json';\n`;
    indexJsContent += `            options.body = JSON.stringify(params || {});\n`;
    indexJsContent += `        } else if ((method === 'GET' || method === 'DELETE') && params && Object.keys(params).length > 0) {\n`;
    indexJsContent += `            const filteredParams = {};\n`;
    indexJsContent += `            for (const key in params) {\n`;
    indexJsContent += `                if (params[key] !== undefined && params[key] !== null) {\n`;
    indexJsContent += `                    filteredParams[key] = params[key];\n`;
    indexJsContent += `                }\n`;
    indexJsContent += `            }\n`;
    indexJsContent += `            if (Object.keys(filteredParams).length > 0) {\n`;
    indexJsContent += `                const queryParams = new URLSearchParams(filteredParams);\n`;
    indexJsContent += `                actualUrl += \`?\${queryParams.toString()}\`; \n`;
    indexJsContent += `            }\n`;
    indexJsContent += `        }\n\n`;
    indexJsContent += `        const response = await this.fetchInstance(actualUrl, options);\n\n`;
    indexJsContent += `        if (!response.ok) {\n`;
    indexJsContent += `            let errorData = 'Failed to parse error response';\n`;
    indexJsContent += `            try { errorData = await response.json(); } catch (e) { try { errorData = await response.text(); } catch (e2) { /* ignore */ } }\n`;
    indexJsContent += `            console.error(\`API Error [\${method} \${actualUrl}]: \${response.status}\`, errorData);\n`;
    indexJsContent += `            const err = new Error(\`API Error \${response.status} for \${method} \${endpoint}\`); \n`;
    indexJsContent += `            err.data = errorData; err.status = response.status; err.response = response;\n`;
    indexJsContent += `            throw err;\n`;
    indexJsContent += `        }\n\n`;
    indexJsContent += `        const contentType = response.headers.get('content-type');\n`;
    indexJsContent += `        if (response.status === 204 || !contentType) { return undefined; }\n`;
    indexJsContent += `        if (contentType.includes('application/json')) { return response.json(); }\n`;
    indexJsContent += `        return response.text();\n`;
    indexJsContent += `    }\n`;

    indexJsContent += `\n    // API Group Instances\n`;
    for (const group of collectedApiGroups) {
        indexJsContent += `    ${group.groupInstanceName} = new ${group.groupClassName}(this.fetcher.bind(this));\n`;
    }
    indexJsContent += `}\n`;

    await fs.writeFile(OUTPUT_CLIENT_INDEX_JS_PATH, indexJsContent);
    console.log(`Generated SiyuanClient in: client/index.js`);

    let finalDtsContent = "// TypeScript definitions for Siyuan API Client\n\n";
    for (const typeName in GENERATED_TYPES) {
        finalDtsContent += `${GENERATED_TYPES[typeName]}\n\n`;
    }
    finalDtsContent += allGroupApiInterfacesDts;
    finalDtsContent += "\n";

    finalDtsContent += "export interface SiyuanClientConfig {\n";
    finalDtsContent += "  baseUrl?: string;\n";
    finalDtsContent += "  apiToken?: string;\n";
    finalDtsContent += "  customFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;\n";
    finalDtsContent += "}\n\n";

    finalDtsContent += "export class SiyuanClient {\n";
    finalDtsContent += "  constructor(config?: SiyuanClientConfig);\n\n";
    for (const group of collectedApiGroups) {
        finalDtsContent += `  ${group.groupInstanceName}: ${group.groupClassName};\n`;
    }
    finalDtsContent += "}\n";

    await fs.writeFile(OUTPUT_DTS_FILE, finalDtsContent);
    console.log(`Generated TypeScript definitions file: ${OUTPUT_DTS_FILE.replace(__dirname, '')}`);

    console.log("\nGeneration complete! Please ensure you have 'zod' installed in your project (`npm install zod` or `yarn add zod`).");
}

generateClient().catch(err => {
    console.error("Error during client generation:", err);
});