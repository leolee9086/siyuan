import assert from "node:assert/strict";
import test from "node:test";
import {queueTransaction} from "./transactionQueue";

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, reject, resolve};
};

test("transactions for one editor run in submission order", async () => {
    const protyle = {};
    const first = deferred();
    const started = deferred();
    const calls: string[] = [];
    const firstTask = queueTransaction(protyle, async () => {
        calls.push("first:start");
        started.resolve();
        await first.promise;
        calls.push("first:end");
    });
    const secondTask = queueTransaction(protyle, async () => {
        calls.push("second");
    });

    await started.promise;
    assert.deepEqual(calls, ["first:start"]);
    first.resolve();
    await Promise.all([firstTask, secondTask]);
    assert.deepEqual(calls, ["first:start", "first:end", "second"]);
});

test("a failed transaction stays observable and does not block the next task", async () => {
    const protyle = {};
    const failure = new Error("transaction failed");
    const calls: string[] = [];
    const failedTask = queueTransaction(protyle, async () => {
        throw failure;
    });
    const nextTask = queueTransaction(protyle, async () => {
        calls.push("next");
    });

    await assert.rejects(failedTask, failure);
    await nextTask;
    assert.deepEqual(calls, ["next"]);
});

test("different editors do not share a queue", async () => {
    const firstEditor = {};
    const secondEditor = {};
    const gate = deferred();
    const firstTask = queueTransaction(firstEditor, () => gate.promise);
    let secondCompleted = false;
    await queueTransaction(secondEditor, async () => {
        secondCompleted = true;
    });

    assert.equal(secondCompleted, true);
    gate.resolve();
    await firstTask;
});
