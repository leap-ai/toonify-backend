import axios from 'axios';
import Replicate from "replicate";
import { config } from '../config';
// import { fal } from "@fal-ai/client";

// Initialize Replicate client with API token
const replicate = new Replicate({
  auth: config.replicate.token,
});

// // Initialize fal.ai client with API key
// /*
// fal.config({
//   credentials: config.fal.key,
// });
// */

// // Interface for fal.ai response
// /*
// interface GenerationResult {
//   images: {
//     url: string;
//     content_type: string;
//   }[];
//   prompt: string;
// }
// */

interface GenerationResult {
  images: {
    url: string;
    content_type: string;
  }[];
}

// Function to upload image to Replicate storage
export async function uploadImageToFal(base64Image: string): Promise<string> {
  try {
    // Call the upload model on Replicate
    const output = await replicate.run(
      "chigozienri/upload:4b7f8c9610dafeb7ebc6ce3a5e3e9dd0d39d85c5a67612d3f48cfb90b8b57a2d",
      {
        input: {
          image: base64Image
        }
      }
    );

    if (!output) {
      throw new Error('No URL in response from Replicate');
    }

    // The upload model returns a string URL
    return String(output);
  } catch (error) {
    console.error('Error uploading image to Replicate:', error);
    throw new Error('Failed to upload image to Replicate storage');
  }
}

// Function to generate cartoon image using Replicate
export async function generateCartoonImage(imageUrl: string): Promise<string> {
  try {
    // Call the cartoonify model on Replicate
    const output = await replicate.run(
      "catacolabs/cartoonify:e4b13b8a276fd23c34495200de121d37b19b31b20764e99826a1bce9b952f735",
      {
        input: {
          image: imageUrl
        }
      }
    );

    if (!output || (Array.isArray(output) && output.length === 0)) {
      throw new Error('No image URL in response');
    }

    // The cartoonify model returns an array with the URL as the first element
    return Array.isArray(output) ? String(output[0]) : String(output);
  } catch (error) {
    console.error('Error generating cartoon image:', error);
    throw new Error('Failed to generate cartoon image');
  }
}

// Old fal.ai implementation for reference
/*
// Function to upload image to fal.ai storage
export async function uploadImageToFal_old(base64Image: string): Promise<string> {
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

// Function to generate cartoon image from fal.ai URL
export async function generateCartoonImage_old(imageUrl: string): Promise<string> {
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
*/ 