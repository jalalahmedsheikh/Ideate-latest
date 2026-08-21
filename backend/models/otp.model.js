import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // OTP expires automatically after 10 minutes (600 seconds)
    },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1 });

export const OTP = mongoose.model("OTP", otpSchema);
