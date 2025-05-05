import axios from 'axios';
import { fal } from "@fal-ai/client";
import replicate from 'replicate';
import { config } from '../config';

// Initialize fal.ai client with API key
fal.config({
  credentials: config.fal.key,
});

const replicateService = new replicate({
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
export async function uploadImageToFal(base64Image: string): Promise<string> {
  try {
    // Extract the base64 data from the data URL
    const base64Data = base64Image.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a File object
    const file = new File([buffer], 'upload.jpg', { type: 'image/jpeg' });

    // Upload to Fal.ai storage
    const falImageUrl = await fal.storage.upload(file);

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
  
    const response = await replicateService.run("aaronaftab/mirage-ghibli:166efd159b4138da932522bc5af40d39194033f587d9bdbab1e594119eae3e7f", {
      input,
    }) as string[]; // Cast response to string array based on schema
  
    // --- Fetch image from Replicate URL and upload to Fal ---
    if (!Array.isArray(response) || response.length === 0 || typeof response[0] !== 'string') {
      console.error('Invalid response from Replicate:', response);
      throw new Error('Invalid or empty response from Replicate model');
    }

    const replicateOutputUrl = response[0];
    console.log(`Generated image URL from Replicate: ${replicateOutputUrl}`);

    // Fetch the image data from the Replicate URL
    const imageResponse = await axios.get(replicateOutputUrl, {
      responseType: 'arraybuffer' // Get data as ArrayBuffer
    });

    if (imageResponse.status !== 200 || !imageResponse.data) {
        throw new Error(`Failed to fetch image from Replicate URL: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(imageResponse.data);
    // Infer mime type or default (Replicate often uses jpg/png)
    const mimeType = imageResponse.headers['content-type'] || 'image/jpeg'; 
    const fileName = `ghibli_${Date.now()}.jpg`; // Create a dynamic filename

    // Create a File object
    // const imageFile = new File([imageBuffer], fileName, { type: mimeType });
    // Convert buffer to base64
    const base64Image = `data:image/jpg;base64,${imageBuffer.toString('base64')}`;

    // Upload the File object to Fal storage
    const outputImageUrl = await uploadImageToFal(base64Image);
    // ------------------------------------------------------

    return outputImageUrl;
  } catch (error) {
    console.error('Error generating Ghibli image via Replicate:', error);
    // More specific error message
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
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