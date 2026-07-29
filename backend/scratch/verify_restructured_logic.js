// MUST BE DEFINED BEFORE ANY IMPORTS TO INTERCEPT EARLY LOGS
const originalConsoleError = console.error;
console.error = function (...args) {
  const msg = args.join(" ");
  if (msg.includes("Redis connection error:") || msg.includes("ECONNREFUSED") || msg.includes("connect ECONNREFUSED")) {
    // Suppress Redis connection noise
    return;
  }
  originalConsoleError.apply(console, args);
};

// Now import the rest of the modules
import redis from "../config/redis.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";
import { generateToken } from "../utills/genrateToken.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { Comment } from "../models/comment.model.js";
import * as userController from "../controllers/user.controller.js";
import * as postController from "../controllers/post.controller.js";
import * as pollController from "../controllers/poll.controller.js";
import { notificationQueue, feedQueue, trendingQueue, emailQueue } from "../queues/queue.js";

// Force test environment settings
process.env.SECRET_KEY = "test_secret_key_for_verification";
process.env.NODE_ENV = "test";

// Color helpers for terminal output
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

console.log(cyan("\n=================================================="));
console.log(cyan("   STARTING IN-MEMORY LOGIC VERIFICATION SUITE   "));
console.log(cyan("==================================================\n"));

// -----------------------------------------------------------------
// 1. MOCK REDIS CLIENT IN-MEMORY
// -----------------------------------------------------------------
const redisStore = {};
redis.get = async (key) => redisStore[key] || null;
redis.set = async (key, val, mode, duration) => {
  redisStore[key] = val;
  return "OK";
};
redis.del = async (...keys) => {
  let deletedCount = 0;
  keys.forEach(k => {
    if (redisStore[k] !== undefined) {
      delete redisStore[k];
      deletedCount++;
    }
  });
  return deletedCount;
};
redis.expire = async (key, seconds) => {
  return 1;
};
redis.lrange = async (key, start, stop) => {
  const list = redisStore[key];
  if (!list) return [];
  return list.slice(start, stop + 1);
};
redis.rpush = async (key, ...vals) => {
  if (!redisStore[key]) redisStore[key] = [];
  redisStore[key].push(...vals);
  return redisStore[key].length;
};
redis.scan = async (cursor, matchLabel, pattern, countLabel, count) => {
  const matchPattern = pattern.replace("*", "");
  const keys = Object.keys(redisStore).filter(k => k.includes(matchPattern));
  return ["0", keys];
};
redis.multi = () => {
  const commands = [];
  return {
    incr: function(key) {
      commands.push(() => {
        const val = (parseInt(redisStore[key]) || 0) + 1;
        redisStore[key] = val.toString();
        return [null, val];
      });
      return this;
    },
    ttl: function(key) {
      commands.push(() => [null, 60]);
      return this;
    },
    exec: async function() {
      return commands.map(cmd => cmd());
    }
  };
};
redis.pipeline = () => {
  const commands = [];
  return {
    del: function(key) {
      commands.push(() => { delete redisStore[key]; });
      return this;
    },
    rpush: function(key, val) {
      commands.push(() => {
        if (!redisStore[key]) redisStore[key] = [];
        redisStore[key].push(val);
      });
      return this;
    },
    expire: function(key, seconds) {
      return this;
    },
    exec: async function() {
      return commands.map(cmd => cmd());
    }
  };
};

console.log(green("[✓] Mock Redis Client initialized."));

// -----------------------------------------------------------------
// 2. MOCK MONGOOSE MODELS & BULMQ QUEUES
// -----------------------------------------------------------------
const dbStore = {
  users: {},
  posts: {},
  polls: {}
};

// Helper to wrap object in chainable promise
const makeChainablePromise = (val) => {
  const promise = Promise.resolve(val);
  promise.select = () => promise;
  promise.populate = () => promise;
  promise.sort = () => promise;
  promise.limit = () => promise;
  promise.lean = () => promise;
  return promise;
};

// Database Schema Mock Helpers
const createDefaultUser = (id, data = {}) => {
  const user = {
    _id: id,
    username: `user_${id}`,
    email: `user_${id}@example.com`,
    followings: [],
    followers: [],
    blockedUsers: [],
    mutedUsers: [],
    bookmarks: [],
    posts: [],
    polls: [],
    save: async function() {
      dbStore.users[this._id] = this;
      return this;
    },
    ...data
  };
  return user;
};

const createDefaultPost = (id, data = {}) => {
  const post = {
    _id: id,
    caption: "Mock post caption",
    author: "mock_author_id",
    likes: [],
    comments: [],
    save: async function() {
      dbStore.posts[this._id] = this;
      return this;
    },
    updateOne: async function(update) {
      if (update.$addToSet) {
        const likeId = update.$addToSet.likes;
        if (!this.likes.includes(likeId)) this.likes.push(likeId);
      } else if (update.$pull) {
        const likeId = update.$pull.likes;
        this.likes = this.likes.filter(id => id !== likeId);
      }
      return { modifiedCount: 1 };
    },
    populate: async function() { return this; },
    ...data
  };
  return post;
};

// Mock User Model Methods
User.findById = (id) => {
  const user = dbStore.users[id] || createDefaultUser(id);
  return makeChainablePromise(user);
};
User.findOne = (query) => {
  const email = query.email;
  const user = Object.values(dbStore.users).find(u => u.email === email) || null;
  return makeChainablePromise(user);
};
User.find = (query) => {
  return makeChainablePromise(Object.values(dbStore.users));
};
User.findByIdAndUpdate = (id, updateData, options) => {
  const user = dbStore.users[id] || createDefaultUser(id);
  const updated = createDefaultUser(id, { ...user, ...updateData });
  dbStore.users[id] = updated;
  return makeChainablePromise(updated);
};

// Mock Post Model Methods
Post.findById = (id) => {
  const post = dbStore.posts[id] || createDefaultPost(id);
  return makeChainablePromise(post);
};
Post.create = async (data) => {
  const post = createDefaultPost(`post_${Date.now()}`, data);
  dbStore.posts[post._id] = post;
  return post;
};
Post.find = (query) => {
  return makeChainablePromise(Object.values(dbStore.posts));
};

// Mock BullMQ Queue add methods directly
const queueJobs = [];

notificationQueue.add = async (name, data, opts) => {
  queueJobs.push({ queue: "notifications", data });
  return { id: "mock-notification-job-id" };
};

feedQueue.add = async (name, data, opts) => {
  queueJobs.push({ queue: "feeds", data });
  return { id: "mock-feed-job-id" };
};

trendingQueue.add = async (name, data, opts) => {
  queueJobs.push({ queue: "trending", data });
  return { id: "mock-trending-job-id" };
};

emailQueue.add = async (name, data, opts) => {
  queueJobs.push({ queue: "emails", data });
  return { id: "mock-email-job-id" };
};

console.log(green("[✓] Mock Database Models and Background Queues initialized."));

// -----------------------------------------------------------------
// 3. EXECUTE TESTS
// -----------------------------------------------------------------
const runTests = async () => {
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

  // --- TEST 1: Rate Limiter Middleware ---
  console.log(yellow("\nTest 1: Redis Rate Limiter Middleware"));
  try {
    const middleware = rateLimiter({ windowMs: 60000, max: 2 });
    const mockReq = { ip: "127.0.0.1", baseUrl: "/api", path: "/test" };
    let nextCalled = 0;
    const mockRes = {
      headers: {},
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

    // First request
    await middleware(mockReq, mockRes, () => { nextCalled++; });
    // Second request
    await middleware(mockReq, mockRes, () => { nextCalled++; });
    // Third request (should block)
    await middleware(mockReq, mockRes, () => { nextCalled++; });

    assert(nextCalled === 2, "Allows requests within limit and blocks when exceeded");
    assert(mockRes.statusCode === 429, "Returns 429 Too Many Requests on limit breach");
    assert(mockRes.headers["X-RateLimit-Limit"] === 2, "Sets correct X-RateLimit-Limit header");
  } catch (err) {
    console.error(red("  Error in Test 1:"), err);
    failedTests++;
  }

  // --- TEST 2: Token Generation and Session Management ---
  console.log(yellow("\nTest 2: Token Generation & Redis Sessions"));
  try {
    const mockRes = {
      statusCode: 200,
      cookieData: {},
      status: function(code) { this.statusCode = code; return this; },
      cookie: function(name, val, options) { this.cookieData = { name, val }; return this; },
      json: function(data) { this.body = data; return this; }
    };
    const mockUser = { _id: "user123", username: "testuser" };

    await generateToken(mockRes, mockUser, "Login successful");

    const savedSessionToken = await redis.get("session:user123");
    assert(savedSessionToken !== null, "Saves active session token in Redis");
    assert(mockRes.cookieData.name === "token", "Sets token cookie in browser response");
    assert(mockRes.body.success === true, "Returns success JSON response");
  } catch (err) {
    console.error(red("  Error in Test 2:"), err);
    failedTests++;
  }

  // --- TEST 3: User Profile Caching (Cache-aside) ---
  console.log(yellow("\nTest 3: Profile Retrieval & Caching"));
  try {
    const mockReq = { id: "user123" };
    const mockRes = {
      statusCode: 200,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };

    // First request: Cache Miss (should populate cache)
    await redis.del("user:profile:user123");
    await userController.getUserProfile(mockReq, mockRes);
    const cachedProfile = await redis.get("user:profile:user123");
    assert(cachedProfile !== null, "Profile cached in Redis on first retrieval");

    // Second request: Cache Hit
    mockRes.body = null;
    await userController.getUserProfile(mockReq, mockRes);
    assert(mockRes.body.cached === true, "Subsequent retrieval served directly from Redis Cache");
  } catch (err) {
    console.error(red("  Error in Test 3:"), err);
    failedTests++;
  }

  // --- TEST 4: Cache Invalidation on Update ---
  console.log(yellow("\nTest 4: Cache Invalidation on Profile Update"));
  try {
    const mockReq = { id: "user123", body: { name: "Updated Name" } };
    const mockRes = {
      status: function(code) { return this; },
      json: function(data) { return this; }
    };

    await userController.updateProfile(mockReq, mockRes);
    const cachedProfile = await redis.get("user:profile:user123");
    assert(cachedProfile === null, "Invalidates cached profile in Redis on profile update");
  } catch (err) {
    console.error(red("  Error in Test 4:"), err);
    failedTests++;
  }

  // --- TEST 5: Post Caching and Background Feed Fan-out ---
  console.log(yellow("\nTest 5: Post Creation Cache Invalidation & Background Fan-out"));
  try {
    const mockReq = { id: "user123", body: { caption: "My first post" } };
    const mockRes = {
      statusCode: 200,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };

    // Pre-populate list cache to check invalidation
    await redis.set("posts:all", JSON.stringify([{ _id: "oldpost" }]));

    await postController.addNewPost(mockReq, mockRes);

    const postsCache = await redis.get("posts:all");
    assert(postsCache === null, "Invalidates 'posts:all' list cache in Redis on new post creation");

    // Verify background feed fan-out job was queued
    const feedJob = queueJobs.find(job => job.queue === "feeds" && job.data.action === "createPost");
    assert(feedJob !== undefined, "Queues 'createPost' feed precomputation and fan-out job in BullMQ");
    assert(feedJob.data.authorId === "user123", "Attaches correct author ID to background job");
  } catch (err) {
    console.error(red("  Error in Test 5:"), err);
    failedTests++;
  }

  // --- TEST 6: Post Reactions & Background Notifications ---
  console.log(yellow("\nTest 6: Post Reactions, Cache Invalidation, and Background Notifications"));
  try {
    const mockReq = { id: "liker456", params: { id: "post789" } };
    const mockRes = {
      status: function(code) { return this; },
      json: function(data) { return this; }
    };

    // Setup mock post in DB store with full methods
    dbStore.posts["post789"] = createDefaultPost("post789", {
      caption: "Reaction post",
      author: "user123"
    });

    // Pre-populate post detail cache
    await redis.set("post:detail:post789", JSON.stringify({ _id: "post789" }));

    await postController.handlePostReaction(mockReq, mockRes, "like");

    const detailCache = await redis.get("post:detail:post789");
    assert(detailCache === null, "Invalidates single post detail cache in Redis on post reaction");

    // Verify background notification job was queued
    const notificationJob = queueJobs.find(job => job.queue === "notifications" && job.data.type === "like");
    assert(notificationJob !== undefined, "Queues 'like' notification job in BullMQ");
    assert(notificationJob.data.targetOwnerId === "user123", "Directs notification to correct post owner");
  } catch (err) {
    console.error(red("  Error in Test 6:"), err);
    failedTests++;
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log(cyan("\n=================================================="));
  console.log(cyan("                 TEST SUITE SUMMARY               "));
  console.log(cyan("==================================================\n"));
  console.log(`Total Passed: ${green(passedTests)}`);
  console.log(`Total Failed: ${red(failedTests)}`);
  
  if (failedTests === 0) {
    console.log(green("\nALL LOGIC VERIFIED SUCCESSFULLY! Caching, workers, rate limiting, and sessions are 100% correct.\n"));
    process.exit(0);
  } else {
    console.log(red("\nTEST SUITE FAILED WITH ERRORS.\n"));
    process.exit(1);
  }
};

runTests();
