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
 * @param {Buffer | string} imageBuffer - base64 string or file buffer
 * @param {"anime" | "cartoon" | "ghibli"} style
 * @returns {Promise<Buffer>} - stylized image buffer
 */
async function generateStylizedImage(imageBuffer: File, style: StyleVariant = "anime"): Promise<Buffer> {
  const model = STYLE_MODEL_MAP[style];
  if (!model) throw new Error("Unsupported style: " + style);

  // Convert base64 to buffer if needed
  const buffer = typeof imageBuffer === "string" ? Buffer.from(imageBuffer, "base64") : imageBuffer;

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      buffer,
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "image/png"
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