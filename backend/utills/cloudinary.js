import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config({});

cloudinary.config({
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  cloud_name: process.env.CLOUD_NAME,
});

// Accepts either a file path string OR a multer memoryStorage file object { buffer, mimetype }
export const uploadMedia = async (file) => {
  try {
    let uploadSource;

    if (typeof file === "string") {
      // File path passed directly
      uploadSource = file;
    } else if (file && file.buffer) {
      // Multer memoryStorage: convert buffer → base64 data URI
      const base64 = file.buffer.toString("base64");
      uploadSource = `data:${file.mimetype};base64,${base64}`;
    } else {
      throw new Error("Invalid file input for Cloudinary upload");
    }

    const uploadResponse = await cloudinary.uploader.upload(uploadSource, {
      resource_type: "auto",
      folder: "ideate_profiles",
    });
    return uploadResponse;
  } catch (error) {
    console.error("Cloudinary upload error:", error.message);
    throw error; // Re-throw so the controller catches it properly
  }
};

export const deleteMediaFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log("Cloudinary delete error:", error.message);
  }
};

export const deleteVideoFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  } catch (error) {
    console.log("Cloudinary video delete error:", error.message);
  }
};
