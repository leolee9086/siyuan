const assert = require("node:assert/strict");
const test = require("node:test");
const createWebpackConfigs = require("../webpack.config");

test("Development builds expose explicit continuous and one-shot lifecycles", () => {
    const continuous = createWebpackConfigs({}, {mode: "development"});
    const oneShot = createWebpackConfigs({oneShot: true}, {mode: "development"});
    const production = createWebpackConfigs({}, {mode: "production"});

    assert.equal(continuous.every((config) => config.watch === true), true);
    assert.equal(oneShot.every((config) => config.watch === false), true);
    assert.equal(production.every((config) => config.watch === false), true);
    assert.deepEqual(
        oneShot.map((config) => config.name),
        continuous.map((config) => config.name),
    );
});
