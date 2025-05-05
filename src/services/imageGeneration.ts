import axios from 'axios';
import { fal } from "@fal-ai/client";
import Replicate from 'replicate';
import { config } from '../config';
import { Readable } from 'stream';

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
export type ImageVariant = 'toon' | 'ghiblix';
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

// --- Placeholder for Pixar style generation ---
async function generateWithPixarModel(imageUrl: string): Promise<string> {
  console.log(`Generating Pixar style for: ${imageUrl}`);
  // Replace with actual API call to a Pixar-style model
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  // For now, return the original URL or a placeholder/error
  // throw new Error('Pixar model not implemented yet');
  return 'https://placehold.co/600x400/DCECEB/2A4C4D.png?text=Pixar+Style\n(Not+Implemented)';
}

// --- Main service function to select model based on variant ---
export async function generateImageWithVariant(
  imageUrl: string,
  variant: ImageVariant,
  inputFile?: File,
): Promise<string> {
  console.log(`Generating image with variant: ${variant}`);
  switch (variant) {
    case 'toon':
      return await generateWithFalCartoonify(imageUrl);
    case 'ghiblix':
      return await generateWithGhiblixModel(imageUrl);
    default:
      // Fallback or error - though the route handler should prevent invalid variants
      console.warn(`Unknown variant received in service: ${variant}. Falling back to cartoon.`);
      return await generateWithFalCartoonify(imageUrl);
  }
} 