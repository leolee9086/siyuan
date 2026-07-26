import assert from "node:assert/strict";
import test from "node:test";
import {collectGatewayHopsFromSource} from "../../scripts/check-imports-gateway-hops.mjs";

test("imports gateway hop checker accepts direct implementation and package imports", () => {
    const source = [
        'import {fetchPost} from "../../util/network/fetch";',
        'import type {AppFacade} from "../../app/AppFacade.types";',
        'import dayjs from "dayjs";',
    ].join("\n");
    assert.deepEqual(collectGatewayHopsFromSource("src/domain/imports.ts", source), []);
});

test("imports gateway hop checker reports import and export forwarding", () => {
    const source = [
        'import {first} from "../imports";',
        'export {second} from "../../plugin/imports";',
        'import {third} from "./imports";',
    ].join("\n");
    assert.deepEqual(collectGatewayHopsFromSource("src/domain/imports.ts", source), [
        {filePath: "src/domain/imports.ts", line: 1, specifier: "../imports"},
        {filePath: "src/domain/imports.ts", line: 2, specifier: "../../plugin/imports"},
        {filePath: "src/domain/imports.ts", line: 3, specifier: "./imports"},
    ]);
});

test("imports gateway hop checker ignores ordinary production modules", () => {
    const source = 'import {dependency} from "../imports";';
    assert.deepEqual(collectGatewayHopsFromSource("src/domain/feature.ts", source), []);
});
