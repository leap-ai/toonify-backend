import axios from 'axios';
import { fal } from "@fal-ai/client";
import Replicate from 'replicate';
import { config } from '../config';
import { uploadImageToFal, generateWithFalCartoonify, generateWithFalGhiblify, generateWithFalPlushify } from './falService';

// Initialize fal.ai client with API key
fal.config({
  credentials: config.fal.key,
});

const replicate = new Replicate({
  auth: config.replicate.token,
});

const ReplicateModels = {
  "ghiblix": {
    model: {
      creator: "aaronaftab",
      name: "mirage-ghibli",
      id: "166efd159b4138da932522bc5af40d39194033f587d9bdbab1e594119eae3e7f"
    },
    input: {
      prompt: "GHBLI anime style photo",
      go_fast: true,
      guidance_scale: 10,
      prompt_strength: 0.77,
      num_inference_steps: 38
    }
  },
  "sticker": {
    model: {
      creator: "fofr",
      name: "face-to-sticker",
      id: "764d4827ea159608a07cdde8ddf1c6000019627515eb02b6b449695fd547e5ef"
    },
    input: {
      steps: 20,
      width: 1024,
      height: 1024,
      prompt: "a person",
      upscale: false,
      upscale_steps: 10,
      negative_prompt: "",
      prompt_strength: 4.5,
      ip_adapter_noise: 0.5,
      ip_adapter_weight: 0.2,
      instant_id_strength: 0.7
    }
  },
  "comic": {
    model: {
      creator: "catacolabs",
      name: "cartoonify",
      id: "f109015d60170dfb20460f17da8cb863155823c85ece1115e1e9e4ec7ef51d3b"
    },
    input: {
      seed: Math.floor(Math.random() * 100000),
    }
  }
}

// --- Define allowed image variants ---
/**
 * The variants of images that can be generated
 * Fal.AI Cartoonify - Pixar style 0.1$ per image
 * Fal.AI Plushify - Plush style 0.1$ per image
 * Fal.AI Ghiblify - Studio Ghibli style 0.05$ per image
 * Replicate Mirage Ghibli - Studio Ghibli style $0.018 per image
 * Replicate fofr/face-to-sticker - Sticker style $0.026 per image
 * Replicate Catacolabs/Cartoonify - Comic style $0.0055 per image
 */
export type ImageVariant = 'pixar' | 'ghiblix' | 'sticker' | 'plushy';

// To generate cartoon image from Replicate using the mirage-ghibli model
async function generateWithReplicateModel(imageUrl: string, replicateVariant: "ghiblix" | "sticker" | "comic" = "sticker"): Promise<string> {
  try {
    console.log(`Generating ${replicateVariant} style for: ${imageUrl}`);
    const input = {
      image: imageUrl,
      ...ReplicateModels[replicateVariant].input,
    };

    const { model: { creator, name, id } } = ReplicateModels[replicateVariant];

    const model = `${creator}/${name}:${id}` as `${string}/${string}:${string}`;
    let output: any;

    if (replicateVariant === "comic") {
      output = await replicate.run(model, {
        input,
      }) as any;
    } else {
      [output] = await replicate.run(model, {
        input,
      }) as any[];
    }

    if (!output || typeof output.blob !== 'function') {
      console.error('Unexpected response format from Replicate. Expected object with .blob method:', output);
      throw new Error('Unexpected response format from Replicate model');
    }

    console.log('Received output object from Replicate. Getting blob...');
    const imageBlob: Blob = await output.blob(); // Await the blob promise

    if (!imageBlob) {
      throw new Error('Failed to get blob from Replicate response');
    }

    console.log(`Blob received, size: ${imageBlob.size}, type: ${imageBlob.type}`);

    // Create a filename (use blob type extension or default)
    const fileExtension = imageBlob.type.split('/')[1] || 'webp';
    const fileName = `${replicateVariant}_${Date.now()}.${fileExtension}`;

    // Create a File object from the Blob
    const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });

    // --- Upload the File object directly to Fal storage ---
    console.log('Uploading blob-derived file to Fal storage...');
    const outputImageUrl = await uploadImageToFal(imageFile);
    console.log('File uploaded to Fal:', outputImageUrl);
    // -----------------------------------------------------

    return outputImageUrl;
  } catch (error) {
    console.error(`Error generating ${replicateVariant} image via Replicate:`, error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
    } else if (error instanceof Error) {
       console.error('Error message:', error.message)
    }
    throw new Error(`Failed to generate ${replicateVariant} image using Replicate`);
  }
}

// --- Main service function to select model based on variant ---
export async function generateImageWithVariant(
  imageUrl: string,         // URL of uploaded original for most models
  variant: ImageVariant,
  base64Image?: string     // Optional: Original base64 for models needing it (HF)
): Promise<string> {
  switch (variant) {
    case 'plushy':
      // Replicate comic needs the URL
      return await generateWithFalPlushify(imageUrl);
    case 'pixar':
      // Fal cartoonify needs the URL
      return await generateWithFalCartoonify(imageUrl);
    case 'ghiblix':
      // Replicate Ghibli needs the URL
      return await generateWithFalGhiblify(imageUrl);
    case 'sticker':
      // Replicate Sticker needs the URL
      return await generateWithReplicateModel(imageUrl, "sticker");
    default:
      // Fallback or error
      console.warn(`Unknown variant received in service: ${variant}. Falling back to toon.`);
      return await generateWithFalCartoonify(imageUrl);
  }
} 