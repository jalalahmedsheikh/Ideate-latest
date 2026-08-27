import jwt from "jsonwebtoken";
import redis from "../config/redis.js";

const isAuthenticated = async (req, res, next) => {
  try {
    // Get the token from cookies or Authorization header
    let token = req.cookies.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if the token is not found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token not found. Please login to proceed.",
      });
    }

    // Verify the token using the secret key
    const verifyToken = jwt.verify(token, process.env.SECRET_KEY);

    // If the token is invalid or expired
    if (!verifyToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please login again.",
      });
    }

    // Verify session in Redis if available
    try {
      const cachedToken = await redis.get(`session:${verifyToken.userId}`);
      if (cachedToken && cachedToken !== token) {
        return res.status(401).json({
          success: false,
          message: "Session expired or invalid. Please login again.",
        });
      }
    } catch (redisErr) {
      console.warn("⚠️ Session Redis check skipped:", redisErr.message);
    }

    // Attach the user ID to the request object for use in subsequent routes
    req.id = verifyToken.userId;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired or is invalid. Please login again.",
        code: "SESSION_EXPIRED",
      });
    }

    console.error('Authentication error:', error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying the token. Please try again later.",
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      try {
        const verifyToken = jwt.verify(token, process.env.SECRET_KEY);
        if (verifyToken && verifyToken.userId) {
          req.id = verifyToken.userId;
        }
      } catch (_) {
        // Guest mode fallback if token invalid/expired
        req.id = null;
      }
    } else {
      req.id = null;
    }
    next();
  } catch (error) {
    req.id = null;
    next();
  }
};

export default isAuthenticated;




