import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";
import { corsHeaders } from '../_shared/cors.ts'

// Add Bunny.net storage configuration
const BUNNY_STORAGE_URL = "https://syd.storage.bunnycdn.com/buisnesstool-course";
const BUNNY_STORAGE_ZONE = "buisnesstool-course"; // Your storage zone name
const BUNNY_PULL_ZONE_URL = `https://${BUNNY_STORAGE_ZONE}.b-cdn.net`; // Add your pull zone URL
const BUNNY_API_KEY = Deno.env.get('BUNNY_API_KEY');

const wasmBytes = await Deno.readFile(
  new URL(
    "magick.wasm",
    import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.30"),
  ),
);

await initializeImageMagick(wasmBytes);

async function uploadToBunnyStorage(imageData, fileName) {
  try {
    const blob = new Blob([imageData], { type: 'image/webp' });
    
    const response = await fetch(`${BUNNY_STORAGE_URL}/${fileName}`, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'image/webp'
      },
      body: blob
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    // Return the Pull Zone URL instead of Storage URL
    return `${BUNNY_PULL_ZONE_URL}/${fileName}`;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ message: "running" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const key = formData.get("key");
    const content = await file.arrayBuffer();
    
    let result = await ImageMagick.read(
      new Uint8Array(content),
      (img) => {
        // Resize to 352x198
        img.resize(16*22, 9*22);
        
        // Convert to WebP format
        return img.write(
          (data) => data,
          MagickFormat.Webp
        );
      },
    );

    // Upload to Bunny.net storage
    const uploadUrl = await uploadToBunnyStorage(result, key);

    return new Response(
      JSON.stringify({ success: true, url: uploadUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});