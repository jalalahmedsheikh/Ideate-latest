import redis, { getCached, setCached, invalidateCached } from "../config/redis.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";
import { Queue, Worker } from "bullmq";
import { server, io } from "../socket/socket.js";
import { io as ioClient } from "socket.io-client";

// Force test environment settings
process.env.NODE_ENV = "test";

// Color helpers for terminal output
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

console.log(cyan("\n=================================================="));
console.log(cyan("   STARTING LIVE REDIS INTEGRATION TEST SUITE     "));
console.log(cyan("==================================================\n"));

const runIntegrationTests = async () => {
  let passedTests = 0;
  let failedTests = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(green(`  [PASS] ${message}`));
      passedTests++;
    } else {
      console.log(red(`  [FAIL] ${message}`));
      failedTests++;
    }
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: LIVE REDIS CONNECTION & PING
    // -----------------------------------------------------------------
    console.log(yellow("Test 1: Connecting to Live Redis Cloud"));
    const pingResponse = await redis.ping();
    assert(pingResponse === "PONG", `Successfully connected to Redis Cloud! Ping response: ${pingResponse}`);

    // -----------------------------------------------------------------
    // TEST 2: CACHE-ASIDE OPERATIONS ON LIVE REDIS
    // -----------------------------------------------------------------
    console.log(yellow("\nTest 2: Cache-Aside Operations (Set, Get, Invalidate)"));
    const testKey = "cache:test:integration:user123";
    const testData = { username: "alex_live", email: "alex@live.com", role: "beta-tester" };

    // Set Cache
    await setCached(testKey, testData, 15); // 15s TTL
    
    // Get Cache
    const retrievedData = await getCached(testKey);
    assert(
      retrievedData && retrievedData.username === "alex_live",
      "Successfully retrieved cached object from Live Redis Cloud"
    );

    // Invalidate Cache
    await invalidateCached(testKey);
    const postInvalidate = await getCached(testKey);
    assert(postInvalidate === null, "Successfully invalidated/deleted cache entry from Live Redis");

    // -----------------------------------------------------------------
    // TEST 3: ACTIVE SESSION MANAGEMENT
    // -----------------------------------------------------------------
    console.log(yellow("\nTest 3: Active Session Tracking & Expiration"));
    const sessionKey = "session:testuser_integration";
    const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.live_test";

    // Create session
    await redis.set(sessionKey, mockToken, "EX", 20); // 20s TTL
    
    // Validate session
    const savedToken = await redis.get(sessionKey);
    assert(savedToken === mockToken, "Saves and validates active session token in Live Redis");

    // Revoke session (logout simulation)
    await redis.del(sessionKey);
    const revokedToken = await redis.get(sessionKey);
    assert(revokedToken === null, "Successfully revokes active session token (Logout)");

    // -----------------------------------------------------------------
    // TEST 4: REDIS PIPELINE RATE LIMITING
    // -----------------------------------------------------------------
    console.log(yellow("\nTest 4: Redis Pipeline Sliding Window Rate Limiter"));
    const limiterMiddleware = rateLimiter({ windowMs: 5000, max: 2 });
    
    // Mock Express Request & Response
    const mockReq = { 
      ip: "99.88.77.66", 
      baseUrl: "/api", 
      path: "/test-limit" 
    };
    
    let nextCalledCount = 0;
    const mockRes = {
      headers: {},
      statusCode: 200,
      setHeader: function(name, val) { this.headers[name] = val; },
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };

    const next = () => { nextCalledCount++; };

    // Trigger 3 requests (Limit is 2)
    await limiterMiddleware(mockReq, mockRes, next);
    await limiterMiddleware(mockReq, mockRes, next);
    await limiterMiddleware(mockReq, mockRes, next);

    assert(nextCalledCount === 2, "Allows requests within limit (2) and blocks subsequent requests");
    assert(mockRes.statusCode === 429, "Returns HTTP 429 Too Many Requests on limit breach");
    assert(mockRes.headers["X-RateLimit-Limit"] === 2, "Sets correct X-RateLimit-Limit header");
    
    // Clean up rate limiter keys from Redis
    const rateLimitKey = "ratelimit:99.88.77.66:/api/test-limit";
    await redis.del(rateLimitKey);

    // -----------------------------------------------------------------
    // TEST 5 & 6: BULLMQ BACKGROUND QUEUES & SOCKET.IO DISPATCH
    // -----------------------------------------------------------------
    console.log(yellow("\nTest 5 & 6: BullMQ Jobs & Socket.io Real-Time Room Dispatch"));

    const port = 8666;
    const testUserId = "user_integration_test_socket";

    // 1. Start Socket.io Server locally
    await new Promise((resolve) => server.listen(port, resolve));
    console.log(`  [✓] Test Socket.io server listening on port ${port}`);

    // 2. Connect Socket.io Client
    const clientSocket = ioClient(`http://localhost:${port}`, {
      query: { userId: testUserId },
      transports: ["websocket"],
      forceNew: true
    });

    // 3. Set up BullMQ Queue and Worker specifically for this integration test
    const testQueueName = "integration-test-notifications";
    const testQueue = new Queue(testQueueName, { connection: redis });
    
    let jobProcessed = false;
    let notificationReceived = null;

    // Await Socket Client Connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Socket.io connection timeout")), 5000);
      clientSocket.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    console.log(`  [✓] Socket.io client connected successfully to room: ${testUserId}`);

    // Register test worker to process the job and push through socket room
    const testWorker = new Worker(
      testQueueName,
      async (job) => {
        const { type, message, targetOwnerId } = job.data;
        console.log(`  [Worker] Processing background job. Target: ${targetOwnerId}, Msg: ${message}`);
        
        jobProcessed = true;
        
        // Broadcast through Socket.io room
        io.to(targetOwnerId).emit("notification", { type, message });
      },
      { connection: redis }
    );

    // 4. Setup Client Listener for notifications
    const notificationPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Notification event timeout")), 8000);
      clientSocket.on("notification", (data) => {
        clearTimeout(timeout);
        notificationReceived = data;
        resolve();
      });
    });

    // 5. Add Job to Live BullMQ Queue on Redis Cloud
    console.log("  [Queue] Adding notification job to live Redis Cloud queue...");
    await testQueue.add("sendNotification", {
      type: "like",
      message: "Sarah liked your story!",
      targetOwnerId: testUserId
    });

    // 6. Wait for worker processing and client socket event receipt
    await notificationPromise;

    assert(jobProcessed === true, "BullMQ worker successfully polled and processed job from Redis Cloud");
    assert(
      notificationReceived && notificationReceived.message === "Sarah liked your story!",
      "Socket.io client successfully received real-time room-targeted notification broadcasted by worker"
    );

    // Clean up connections and servers
    clientSocket.close();
    await testWorker.close();
    await testQueue.close();
    
    // Clear any test queues in Redis
    const keys = await redis.keys(`bull:${testQueueName}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    
    await new Promise((resolve) => server.close(resolve));
    console.log("  [✓] Test Socket.io server and workers stopped.");

  } catch (error) {
    console.error(red("\nIntegration Test Suite Error:"), error);
    failedTests++;
  } finally {
    // Close live Redis connection
    await redis.quit();
    console.log(cyan("\n=================================================="));
    console.log(cyan("           INTEGRATION TEST SUMMARY               "));
    console.log(cyan("==================================================\n"));
    console.log(`Total Passed: ${green(passedTests)}`);
    console.log(`Total Failed: ${red(failedTests)}`);
    
    if (failedTests === 0) {
      console.log(green("\nALL LIVE INTEGRATION TESTS PASSED! Caching, workers, rate limiting, and sockets work perfectly on Redis Cloud!\n"));
      process.exit(0);
    } else {
      console.log(red("\nINTEGRATION TESTS FAILED WITH ERRORS.\n"));
      process.exit(1);
    }
  }
};

runIntegrationTests();
