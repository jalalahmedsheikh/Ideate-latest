import jwt from 'jsonwebtoken';
import redis from '../config/redis.js';

export const generateToken = async (res, user, message) => {
  const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
    expiresIn: '10d',
  });

  // Save session in Redis for active session tracking with a 10-day TTL
  try {
    await redis.set(`session:${user._id}`, token, "EX", 10 * 24 * 60 * 60);
  } catch (err) {
    console.warn("⚠️ Redis session tracking skipped (Redis offline):", err.message);
  }

  return res
    .status(200)
    .cookie('token', token, {
      httpOnly: false,
      sameSite: 'Lax',
      path: "/",
      maxAge: 10 * 24 * 60 * 60 * 1000,
      secure: false,
    })
    .json({
      success: true,
      message,
      token,
      user,
    });
};
