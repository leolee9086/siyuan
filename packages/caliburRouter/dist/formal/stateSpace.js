export function formalUnit(value) {
    if (typeof value === "number" && !Number.isFinite(value)) {
        throw new TypeError("calibur-router: 数值 literal 必须是有限 JSON number。");
    }
    return { kind: "unit", value };
}
export function formalDomain(domain) {
    return { kind: "domain", domain };
}
export function formalObject(properties) {
    return { kind: "object", properties };
}
export function formalUnion(branches) {
    const flattened = branches.flatMap((branch) => branch.kind === "union" ? branch.branches : [branch]);
    if (flattened.length === 0) {
        throw new TypeError("calibur-router: 形式化 union 至少需要一个分支。");
    }
    return flattened.length === 1 ? flattened[0] : { kind: "union", branches: flattened };
}
function sameUnit(left, right) {
    return Object.is(left, right);
}
function unitInDomain(value, domain) {
    return domain === "number"
        ? typeof value === "number" && Number.isFinite(value)
        : typeof value === domain;
}
function flattenBranches(space) {
    return space.kind === "union" ? space.branches.flatMap(flattenBranches) : [space];
}
function isSubsetOfSingle(left, right) {
    if (left.kind === "union") {
        return left.branches.every((branch) => isSubsetOfSingle(branch, right));
    }
    if (right.kind === "union") {
        return formalCovers(left, right.branches);
    }
    if (left.kind === "unit") {
        return right.kind === "unit"
            ? sameUnit(left.value, right.value)
            : right.kind === "domain" && unitInDomain(left.value, right.domain);
    }
    if (left.kind === "domain") {
        return right.kind === "domain" && left.domain === right.domain;
    }
    if (left.kind !== "object" || right.kind !== "object") {
        return false;
    }
    return Object.entries(right.properties).every(([key, rightProperty]) => {
        const leftProperty = left.properties[key];
        return leftProperty !== undefined && formalIsSubset(leftProperty, rightProperty);
    });
}
export function formalIsSubset(left, right) {
    return right.kind === "union"
        ? formalCovers(left, right.branches)
        : isSubsetOfSingle(left, right);
}
function intersectSingle(left, right) {
    if (left.kind === "union" || right.kind === "union") {
        return formalIntersection(left, right);
    }
    if (left.kind === "unit") {
        if (right.kind === "unit") {
            return sameUnit(left.value, right.value) ? left : null;
        }
        return right.kind === "domain" && unitInDomain(left.value, right.domain) ? left : null;
    }
    if (right.kind === "unit") {
        return intersectSingle(right, left);
    }
    if (left.kind === "domain" || right.kind === "domain") {
        return left.kind === "domain" && right.kind === "domain" && left.domain === right.domain
            ? left
            : null;
    }
    const properties = { ...left.properties };
    for (const [key, rightProperty] of Object.entries(right.properties)) {
        const leftProperty = properties[key];
        if (leftProperty === undefined) {
            properties[key] = rightProperty;
            continue;
        }
        const intersection = formalIntersection(leftProperty, rightProperty);
        if (intersection === null) {
            return null;
        }
        properties[key] = intersection;
    }
    return formalObject(properties);
}
export function formalIntersection(left, right) {
    const intersections = [];
    for (const leftBranch of flattenBranches(left)) {
        for (const rightBranch of flattenBranches(right)) {
            const intersection = intersectSingle(leftBranch, rightBranch);
            if (intersection !== null) {
                intersections.push(intersection);
            }
        }
    }
    return intersections.length === 0 ? null : formalUnion(intersections);
}
export function formalOverlaps(left, right) {
    return formalIntersection(left, right) !== null;
}
function collectLeafPaths(space, prefix, result) {
    for (const branch of flattenBranches(space)) {
        if (branch.kind !== "object") {
            continue;
        }
        for (const [key, property] of Object.entries(branch.properties)) {
            const path = [...prefix, key];
            if (flattenBranches(property).every((propertyBranch) => propertyBranch.kind === "object")) {
                collectLeafPaths(property, path, result);
            }
            else {
                result.set(JSON.stringify(path), path);
            }
        }
    }
}
function getAtPath(space, path, depth = 0) {
    const values = [];
    for (const branch of flattenBranches(space)) {
        if (branch.kind !== "object") {
            return null;
        }
        const property = branch.properties[path[depth]];
        if (property === undefined) {
            return null;
        }
        if (depth === path.length - 1) {
            values.push(property);
        }
        else {
            const nested = getAtPath(property, path, depth + 1);
            if (nested === null) {
                return null;
            }
            values.push(nested);
        }
    }
    return formalUnion(values);
}
function finiteUnits(space) {
    const values = [];
    for (const branch of flattenBranches(space)) {
        if (branch.kind === "unit") {
            if (!values.some((value) => sameUnit(value, branch.value))) {
                values.push(branch.value);
            }
            continue;
        }
        if (branch.kind === "domain" && branch.domain === "boolean") {
            for (const value of [false, true]) {
                if (!values.some((current) => sameUnit(current, value))) {
                    values.push(value);
                }
            }
            continue;
        }
        return null;
    }
    return values;
}
function constraintAtPath(path, value) {
    let constraint = formalUnit(value);
    for (let index = path.length - 1; index >= 0; index--) {
        constraint = formalObject({ [path[index]]: constraint });
    }
    return constraint;
}
function proveBranchCovered(universe, patterns) {
    if (patterns.some((pattern) => isSubsetOfSingle(universe, pattern))) {
        return true;
    }
    const constrainedPaths = new Map();
    for (const pattern of patterns) {
        collectLeafPaths(pattern, [], constrainedPaths);
    }
    const partitions = [...constrainedPaths.values()].flatMap((path) => {
        const property = getAtPath(universe, path);
        const values = property === null ? null : finiteUnits(property);
        return values === null || values.length < 2 ? [] : [{ path, values }];
    });
    const prove = (region, partitionIndex) => {
        if (patterns.some((pattern) => isSubsetOfSingle(region, pattern))) {
            return true;
        }
        if (partitionIndex >= partitions.length) {
            return false;
        }
        for (const value of partitions[partitionIndex].values) {
            const intersection = formalIntersection(region, constraintAtPath(partitions[partitionIndex].path, value));
            if (intersection !== null && !prove(intersection, partitionIndex + 1)) {
                return false;
            }
        }
        return true;
    };
    return prove(universe, 0);
}
export function formalCovers(universe, patterns) {
    if (patterns.length === 0) {
        return false;
    }
    const patternBranches = patterns.flatMap(flattenBranches);
    return flattenBranches(universe).every((branch) => proveBranchCovered(branch, patternBranches));
}
export function describeFormalStateSpace(space) {
    switch (space.kind) {
        case "unit":
            return JSON.stringify(space.value);
        case "domain":
            return space.domain;
        case "union":
            return space.branches.map(describeFormalStateSpace).join(" | ");
        case "object":
            return `{ ${Object.entries(space.properties)
                .map(([key, property]) => `${key}: ${describeFormalStateSpace(property)}`)
                .join(", ")} }`;
    }
}
//# sourceMappingURL=stateSpace.js.map