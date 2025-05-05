import axios from 'axios';
import { fal } from "@fal-ai/client";
import Replicate from 'replicate';
import { config } from '../config';
import { Readable } from 'stream';
import { generateStylizedImage } from './HuggingFaceInference';

// Initialize fal.ai client with API key
fal.config({
  credentials: config.fal.key,
});

const replicate = new Replicate({
  auth: config.replicate.token,
});

interface GenerationResult {
  images: {
    url: string;
    content_type: string;
  }[];
  prompt: string;
}

// --- Define allowed image variants ---
export type ImageVariant = 'toon' | 'ghiblix' | 'anime';
// ------------------------------------

// Function to upload image to fal.ai storage
export async function uploadImageToFal(base64Image: string | File): Promise<string> {
  let falImageUrl: string;
  try {
    if (base64Image instanceof File) {
      // Upload the File object directly to Fal storage
      falImageUrl = await fal.storage.upload(base64Image);
    } else {
      // Extract the base64 data from the data URL
      const base64Data = base64Image.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create a File object
      const file = new File([buffer], 'upload.jpg', { type: 'image/jpeg' });

      // Upload to Fal.ai storage
      falImageUrl = await fal.storage.upload(file);
    }

    if (!falImageUrl) {
      throw new Error('No URL in response from fal.ai storage');
    }

    return falImageUrl;
  } catch (error) {
    console.error('Error uploading image to fal.ai:', error);
    throw new Error('Failed to upload image to fal.ai storage');
  }
}

// To generate cartoon image from fal.ai URL using the cartoonify model
async function generateWithFalCartoonify(imageUrl: string): Promise<string> {
  try {
    const response = await axios.post<GenerationResult>(
      'https://fal.run/fal-ai/cartoonify',
      {
        image_url: imageUrl,
      },
      {
        headers: {
          'Authorization': `Key ${config.fal.key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.images?.[0]?.url) {
      throw new Error('No image URL in response');
    }

    return response.data.images[0].url;
  } catch (error) {
    console.error('Error generating cartoon image:', error);
    throw new Error('Failed to generate cartoon image');
  }
}

// To generate cartoon image from Replicate using the mirage-ghibli model
async function generateWithGhiblixModel(imageUrl: string): Promise<string> {
  try {
    console.log(`Generating Ghibli style for: ${imageUrl}`);
    const input = {
      image: imageUrl,
      prompt: "GHBLI anime style photo",
      go_fast: true,
      guidance_scale: 10,
      prompt_strength: 0.77,
      num_inference_steps: 38
    };
  
    const [output] = await replicate.run("aaronaftab/mirage-ghibli:166efd159b4138da932522bc5af40d39194033f587d9bdbab1e594119eae3e7f", {
      input,
    }) as any[];

    if (!output || typeof output.blob !== 'function') {
      console.error('Unexpected response format from Replicate. Expected FileOutput object:', output);
      throw new Error('Unexpected response format from Replicate model');
    }

    console.log('Received FileOutput object from Replicate. Getting blob...');
    const imageBlob: Blob = await output.blob(); // Await the blob promise

    if (!imageBlob) {
      throw new Error('Failed to get blob from Replicate response');
    }

    console.log(`Blob received, size: ${imageBlob.size}, type: ${imageBlob.type}`);

    // Create a filename (use blob type extension or default)
    const fileExtension = imageBlob.type.split('/')[1] || 'webp';
    const fileName = `ghibli_${Date.now()}.${fileExtension}`;

    // Create a File object from the Blob
    const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });

    // --- Upload the File object directly to Fal storage ---
    console.log('Uploading blob-derived file to Fal storage...');
    const outputImageUrl = await uploadImageToFal(imageFile);
    console.log('File uploaded to Fal:', outputImageUrl);
    // -----------------------------------------------------

    return outputImageUrl;
  } catch (error) {
    console.error('Error generating Ghibli image via Replicate:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
    } else if (error instanceof Error) {
       console.error('Error message:', error.message)
    }
    throw new Error('Failed to generate Ghibli image using Replicate');
  }
}

// Updated signature to accept base64 string
async function generateWithAnimeModel(base64Image: string): Promise<string> {
  console.log(`Generating Anime style using Hugging Face for input base64 image.`);
  try {
    // Call the HF inference function - WILL NEED UPDATE in HF file to handle string
    const outputBuffer: Buffer = await generateStylizedImage(base64Image, 'anime'); 

    if (!outputBuffer || outputBuffer.length === 0) {
      throw new Error('Received empty buffer from Hugging Face model');
    }

    console.log(`Buffer received from Hugging Face, size: ${outputBuffer.length}`);

    // --- Convert buffer to File and upload to Fal ---
    // Determine MIME type (HF model likely outputs png or jpg, default to png)
    // Ideally, the HF function would return type info, but let's assume png
    const mimeType = 'image/png'; 
    const fileExtension = 'png';
    const fileName = `anime_${Date.now()}.${fileExtension}`;

    // Create a File object from the Buffer
    const imageFile = new File([outputBuffer], fileName, { type: mimeType });

    // Upload the File object to Fal storage
    console.log('Uploading HF-generated file to Fal storage...');
    const outputImageUrl = await uploadImageToFal(imageFile);
    console.log('File uploaded to Fal:', outputImageUrl);
    // -----------------------------------------------------

    return outputImageUrl;
  } catch (error) {
     console.error('Error generating Anime image via Hugging Face:', error);
     // Add more specific error logging if needed
     throw new Error('Failed to generate Anime image using Hugging Face');
  }
}

// --- Main service function to select model based on variant ---
// Reverted signature
export async function generateImageWithVariant(
  imageUrl: string,         // URL of uploaded original for most models
  variant: ImageVariant,
  base64Image?: string     // Optional: Original base64 for models needing it (HF)
): Promise<string> {
  console.log(`Generating image with variant: ${variant} using URL: ${imageUrl}`);
  switch (variant) {
    case 'toon':
      // Fal cartoonify needs the URL
      return await generateWithFalCartoonify(imageUrl);
    case 'ghiblix':
      // Replicate Ghibli needs the URL
      return await generateWithGhiblixModel(imageUrl);
    case 'anime':
      // Hugging Face needs the base64 string
      if (!base64Image) {
        throw new Error('Base64 image string is required for anime variant but was not provided.');
      }
      return await generateWithAnimeModel(base64Image);
    default:
      // Fallback or error
      console.warn(`Unknown variant received in service: ${variant}. Falling back to toon.`);
      return await generateWithFalCartoonify(imageUrl);
  }
} 