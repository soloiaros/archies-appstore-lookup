import assert from "node:assert/strict";

import {
  createEmbeddingCache,
  queryNeedsIconEmbedding,
} from "../lib/catalog/embedding-policy";

import { classify } from "../lib/router/classify";

async function main() {
  for (const query of [
    "yellow bird icon",
    "green owl app",
    "app with a camera logo",
    "picture of a cat",
    "looks like a compass",
  ]) {
    assert.equal(queryNeedsIconEmbedding(query), true, query);
    assert.equal(classify(query), "discovery", query);
  }

  for (const query of [
    "minimalist habit tracker",
    "budget app with recurring bills",
    "apps for learning Spanish",
    "show me a habit tracker",
  ]) {
    assert.equal(queryNeedsIconEmbedding(query), false, query);
  }

  assert.equal(classify("What is the rating of Bluebird?"), "factual");
  assert.equal(classify("compare red and blue icons"), "comparative");

  let clock = 0;
  let calls = 0;
  const cache = createEmbeddingCache(2, 100, () => clock);
  const calculate = async () => {
    calls += 1;
    return Float32Array.of(calls);
  };

  const [first, concurrent] = await Promise.all([
    cache("same", calculate),
    cache("same", calculate),
  ]);
  assert.equal(calls, 1);
  assert.equal(first, concurrent);

  clock = 101;
  assert.deepEqual(await cache("same", calculate), Float32Array.of(2));

  await cache("next", calculate);
  await cache("third", calculate);
  await cache("same", calculate);
  assert.equal(calls, 5, "oldest entry should be evicted");

  let failures = 0;
  await assert.rejects(cache("failure", async () => {
    failures += 1;
    throw new Error("temporary");
  }));
  await cache("failure", async () => {
    failures += 1;
    return Float32Array.of(1);
  });
  assert.equal(failures, 2, "failed embeddings should be retried");
}

void main();
