import OpenAI from 'openai';
import crypto from 'crypto';
import { uploadImageToFal } from './falService';

export type ImageVariant = 'pixar' | 'ghiblix' | 'sticker' | 'plushy' | 'kawaii' | 'anime';

const Prompts: Record<ImageVariant, string> = {
  pixar: "3D Pixar-style character portrait, large expressive eyes with or without glasses, smooth skin, cinematic lighting, stylized proportions, looking into camera with a soft smile",
  ghiblix: "Studio Ghibli-inspired anime portrait, soft watercolor style, gentle expression, vivid lighting, detailed background with fantasy elements.",
  sticker: "High-contrast cartoon sticker portrait of person(s) with no background, thick white outline, clean vector shading, smooth skin, sharp highlights, glossy comic style, realistic facial features in caricature format.",
  plushy: "Cute plush toy version of this character, ultra soft textures, stitched seams, small round eyes, fluffy and cuddly appearance, photographed on white studio background",
  kawaii: "Kawaii character in Sanrio style, pastel colors, minimal face, big head and small body, soft outline, super cute and simple design.",
  anime: "Highly detailed anime-style picture, soft cel-shading, large expressive eyes, smooth skin, clean line art, delicate highlights, subtle blush, Japanese animation aesthetic, light background, 2D flat color rendering with fine anime detailing, resembling classic anime character design.",
};

interface ImageGenerationOptions {
  image: File;
  variant: ImageVariant;
  isPro?: boolean;
}

export class OpenAIImageGenService {
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });
  }

  /**
   * Generates a cartoon version of the input image using OpenAI's image editing API
   */
  async generateCartoonImage(options: ImageGenerationOptions): Promise<string> {
    try {
      // Call OpenAI API to edit the image
      const response = await this.openai.images.edit({
        image: options.image,
        prompt: Prompts[options.variant],
        model: "gpt-image-1",
        n: 1,
        quality: options.isPro ? "high" : "low",
        size: "auto",
      });

      if (!response?.data?.[0]?.b64_json) {
        throw new Error('No image data returned from OpenAI');
      }

      // Convert base64 to File
      const base64Data = response.data[0].b64_json;
      const outputBuffer = Buffer.from(base64Data, 'base64');
      const outputBlob = new Blob([outputBuffer], { type: 'image/png' });
      const outputFile = new File([outputBlob], `cartoon-${crypto.randomUUID()}.png`, { type: 'image/png' });

      // Upload to Fal.ai storage
      const falImageUrl = await uploadImageToFal(outputFile);

      return falImageUrl;
    } catch (error) {
      console.error('Error generating cartoon image:', error);
      throw error;
    }
  }
}
