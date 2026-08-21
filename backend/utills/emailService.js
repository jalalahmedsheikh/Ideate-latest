import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create nodemailer transporter using environment credentials
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Sends a 6-digit OTP verification email to the recipient.
 * Falls back to console log if EMAIL_USER/EMAIL_PASS are not configured.
 */
export const sendOTPEmail = async (email, otp, username = "User") => {
  const transporter = createTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ideate Email Verification</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .logo { text-align: center; margin-bottom: 24px; }
        .logo-text { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        h2 { color: #ffffff; text-align: center; margin-top: 0; font-size: 22px; }
        p { font-size: 15px; color: #94a3b8; line-height: 1.6; text-align: center; }
        .otp-box { background: linear-gradient(135deg, #312e81, #4c1d95); padding: 20px; border-radius: 12px; text-align: center; margin: 28px 0; border: 1px solid #6366f1; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; margin: 0; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <span class="logo-text">Ideate</span>
        </div>
        <h2>Verify Your Email Address</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>Thank you for signing up for Ideate! Please use the 6-digit verification code below to complete your registration:</p>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>
        <p>This code is valid for <strong>10 minutes</strong>. If you did not request this code, please ignore this email.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Ideate Inc. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log("\n==================================================");
    console.log(`[IDEATE EMAIL SERVICE] No EMAIL_USER/EMAIL_PASS set in .env.`);
    console.log(`[IDEATE EMAIL SERVICE] Verification OTP for ${email}: ${otp}`);
    console.log("==================================================\n");
    return { success: true, simulated: true };
  }

  try {
    await transporter.sendMail({
      from: `"Ideate App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Ideate Email Verification Code: ${otp}`,
      html: htmlContent,
    });
    console.log(`[IDEATE EMAIL SERVICE] OTP email sent successfully to ${email}`);
    return { success: true, simulated: false };
  } catch (error) {
    console.error(`[IDEATE EMAIL SERVICE] Error sending email to ${email}:`, error.message);
    // Log OTP so dev workflow is unbroken even on network/credentials error
    console.log(`[IDEATE EMAIL SERVICE FALLBACK] Verification OTP for ${email}: ${otp}`);
    return { success: true, simulated: true, error: error.message };
  }
};
