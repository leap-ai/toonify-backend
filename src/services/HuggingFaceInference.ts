// Node.js helper function to call Hugging Face Inference API with ControlNet
// You must first get a Hugging Face API key from https://huggingface.co/settings/tokens

import axios from "axios";
import fs from "fs";
import { config } from "../config";

const HUGGINGFACE_API_KEY = config.hf.token; // Set this in your environment variables

// Style to model mapping
const STYLE_MODEL_MAP = {
  anime: "lllyasviel/control_v11p_sd15_canny",  // controlnet with Canny edge + SD
  cartoon: "lllyasviel/control_v11e_sd15_ip2p", // image prompt to image prompt
  ghibli: "nitrosocke/Ghibli-Diffusion"         // stylized diffusion
};

// Define a type for the keys of the map
type StyleVariant = keyof typeof STYLE_MODEL_MAP;

/**
 * @param {File | string} imageInput - File object or base64 string
 * @param {StyleVariant} style
 * @returns {Promise<Buffer>} - stylized image buffer
 */
async function generateStylizedImage(imageInput: File | string, style: StyleVariant = "anime"): Promise<Buffer> {
  const model = STYLE_MODEL_MAP[style];
  if (!model) throw new Error("Unsupported style: " + style);

  let buffer: Buffer;
  let contentType: string = 'image/png'; // Default content type

  // Handle File input
  if (imageInput instanceof File) {
    contentType = imageInput.type; // Use file's actual type
    const arrayBuffer = await imageInput.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } 
  // Handle base64 string input
  else if (typeof imageInput === 'string') {
    // Assume data URL format like data:image/png;base64,...
    const match = imageInput.match(/^data:(image\/\w+);base64,/);
    if (match) {
      contentType = match[1]; // Extract content type from data URL
      const base64Data = imageInput.split(',')[1];
      buffer = Buffer.from(base64Data, "base64");
    } else {
       // Assume raw base64 string without prefix
       buffer = Buffer.from(imageInput, "base64");
       // Keep default contentType or try to infer if needed, though HF might handle raw buffer okay
    }
  } 
  else {
    throw new Error("Invalid input type for generateStylizedImage. Expected File or base64 string.");
  }

  if (!buffer || buffer.length === 0) {
     throw new Error("Failed to create buffer from input image.");
  }

  try {
    console.log(`Calling HF model ${model} with content type ${contentType}`);
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      buffer, // Send the raw buffer
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          // Send the determined Content-Type
          "Content-Type": contentType 
        },
        responseType: "arraybuffer"
      }
    );

    return Buffer.from(response.data); // You can write this to file or return to client
  } catch (err) {
    // Type check for the error
    if (axios.isAxiosError(err)) {
      console.error("Axios Error calling Hugging Face API:", err.response?.data || err.message);
    } else if (err instanceof Error) {
      console.error("Error calling Hugging Face API:", err.message);
    } else {
      console.error("Unknown error calling Hugging Face API:", err);
    }
    throw err;
  }
}

export { generateStylizedImage };