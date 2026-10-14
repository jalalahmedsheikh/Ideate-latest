import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import ioClient from "socket.io-client";
import jwt from "jsonwebtoken";
import { createTestSocketServer } from "./helpers/testServer.js";

const SECRET_KEY = "ideate_development_secret_key_12345";

describe("Phase 2: Socket.IO Authentication & Multi-Device Security Tests", () => {
  let testEnv;

  before(async () => {
    testEnv = await createTestSocketServer({
      mockUsers: new Map([
        ["user_alice", { _id: "user_alice", username: "alice", name: "Alice Smith" }],
        ["user_bob", { _id: "user_bob", username: "bob", name: "Bob Jones" }],
      ]),
    });
  });

  after(async () => {
    await testEnv.close();
  });

  test("1. Rejects unauthenticated connections with no token", async () => {
    await new Promise((resolve) => {
      const client = ioClient(testEnv.url, {
        reconnection: false,
        timeout: 1000,
      });

      client.on("connect_error", (err) => {
        assert.ok(err.message.includes("No token provided"), `Expected No token error, got ${err.message}`);
        client.close();
        resolve();
      });

      client.on("connect", () => {
        client.close();
        assert.fail("Should not have connected without a token");
      });
    });
  });

  test("2. Rejects connection with expired JWT token", async () => {
    const expiredToken = jwt.sign({ userId: "user_alice" }, SECRET_KEY, { expiresIn: -10 });

    await new Promise((resolve) => {
      const client = ioClient(testEnv.url, {
        auth: { token: expiredToken },
        reconnection: false,
        timeout: 1000,
      });

      client.on("connect_error", (err) => {
        assert.ok(err.message.includes("Token expired"), `Expected Token expired error, got ${err.message}`);
        client.close();
        resolve();
      });

      client.on("connect", () => {
        client.close();
        assert.fail("Should not connect with expired token");
      });
    });
  });

  test("3. Rejects connection with invalid signature / tampered token", async () => {
    const fakeToken = jwt.sign({ userId: "user_alice" }, "WRONG_SECRET_KEY");

    await new Promise((resolve) => {
      const client = ioClient(testEnv.url, {
        auth: { token: fakeToken },
        reconnection: false,
        timeout: 1000,
      });

      client.on("connect_error", (err) => {
        assert.ok(err.message.includes("Invalid token"), `Expected Invalid token error, got ${err.message}`);
        client.close();
        resolve();
      });

      client.on("connect", () => {
        client.close();
        assert.fail("Should not connect with invalid token");
      });
    });
  });

  test("4. Connects successfully with valid JWT and derives identity securely", async () => {
    const validToken = jwt.sign({ userId: "user_alice" }, SECRET_KEY, { expiresIn: "1h" });

    await new Promise((resolve) => {
      const client = ioClient(testEnv.url, {
        auth: { token: validToken },
        // Attempt identity spoofing via query param: server must IGNORE this!
        query: { userId: "user_bob_spoofed" },
        reconnection: false,
      });

      client.on("connect", () => {
        assert.strictEqual(client.connected, true);
        assert.strictEqual(testEnv.userSockets.has("user_alice"), true);
        assert.strictEqual(testEnv.userSockets.has("user_bob_spoofed"), false);
        client.on("disconnect", resolve);
        client.close();
      });
    });
  });

  test("5. Multi-device / multi-tab: User remains online until all sockets disconnect", async () => {
    const token = jwt.sign({ userId: "user_multi" }, SECRET_KEY, { expiresIn: "1h" });

    // Connect Tab 1
    const tab1 = ioClient(testEnv.url, { auth: { token }, reconnection: false });
    await new Promise((res) => tab1.on("connect", res));

    // Connect Tab 2
    const tab2 = ioClient(testEnv.url, { auth: { token }, reconnection: false });
    await new Promise((res) => tab2.on("connect", res));

    // Both sockets are registered under user_multi
    const userSocketsSet = testEnv.userSockets.get("user_multi");
    assert.strictEqual(userSocketsSet.size, 2, "user_multi should have 2 active sockets");

    // Helper to wait for server-side state reflection
    const waitForCondition = async (predicate, maxMs = 2000) => {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (predicate()) return;
        await new Promise((r) => setTimeout(r, 25));
      }
    };

    // Close Tab 1
    tab1.close();
    await waitForCondition(() => testEnv.userSockets.get("user_multi")?.size === 1);

    // User must STILL be online because Tab 2 is open!
    assert.strictEqual(testEnv.userSockets.has("user_multi"), true, "user_multi should still be online");
    assert.strictEqual(testEnv.userSockets.get("user_multi").size, 1);

    // Close Tab 2
    tab2.close();
    await waitForCondition(() => !testEnv.userSockets.has("user_multi"));

    // User is now genuinely offline
    assert.strictEqual(testEnv.userSockets.has("user_multi"), false, "user_multi should now be offline");
  });
});
