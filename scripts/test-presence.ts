import assert from "node:assert/strict";

import { Presence } from "../lib/site/presence-do";

const originalNow = Date.now;
let now = 1_000_000;
Date.now = () => now;

function request(path: string, ip = "203.0.113.1") {
  return new Request(`https://presence.internal${path}`, {
    headers: { "x-presence-ip": ip },
  });
}

async function main() {
  try {
    const presence = new Presence({});

    let response = await presence.fetch(request("/beat?sid=a"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { here: 1 });

    now += 89_000;
    response = await presence.fetch(request("/count"));
    assert.deepEqual(await response.json(), { here: 1 });

    now += 2_000;
    response = await presence.fetch(request("/count"));
    assert.deepEqual(await response.json(), { here: 0 });

    for (let i = 3; i < 1800; i += 1) {
      response = await presence.fetch(request("/count"));
      assert.equal(response.status, 200);
    }

    assert.equal((await presence.fetch(request("/count"))).status, 429);
    assert.equal((await presence.fetch(request("/beat?sid=b", "203.0.113.2"))).status, 200);

    now = 3_600_001;
    assert.equal((await presence.fetch(request("/count"))).status, 200);
    assert.equal((await presence.fetch(request("/unknown"))).status, 404);

    console.log("presence window and shared rate limit: pass");
  } finally {
    Date.now = originalNow;
  }
}

void main().catch((error) => {
  Date.now = originalNow;
  console.error(error);
  process.exitCode = 1;
});
