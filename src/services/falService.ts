import { fal } from "@fal-ai/client";
import axios from "axios";
import { config } from "../config";

// Initialize fal.ai client with API key
fal.config({
  credentials: config.fal.key,
});

// Function to upload image to fal.ai storage
async function uploadImageToFal(base64Image: string | File): Promise<string> {
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

// Define types for Fal.ai subscribe response and queue updates
interface FalImageOutput {
  url: string;
  content_type: string;
  width: number;
  height: number;
}

interface GenerationResult {
  images: {
    url: string;
    content_type: string;
  }[];
  prompt: string;
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

async function generateWithFalGhiblify(imageUrl: string): Promise<string> {
  try {
    const response = await axios.post<GenerationResult>(
      'https://fal.run/fal-ai/ghiblify',
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

    console.log("Response", response);

    if (!response.data.images?.[0]?.url) {
      throw new Error('No image URL in response');
    }

    return response.data.images[0].url;
  } catch (error) {
    console.error('Error generating ghibli image:', error);
    throw new Error('Failed to generate ghibli image');
  }
}

export {
  generateWithFalCartoonify,
  generateWithFalGhiblify,
  uploadImageToFal
};