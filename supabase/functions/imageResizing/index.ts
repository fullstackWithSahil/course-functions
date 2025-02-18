import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";
import fs from "node:fs";
// Add Bunny.net storage configuration
const BUNNY_STORAGE_URL = "https://syd.storage.bunnycdn.com/buisnesstool-course";
const BUNNY_API_KEY = "8cb972e1-29b1-4405-9235d083f503-00b0-4b0b"; // Replace with your actual API key

const wasmBytes = await Deno.readFile(
  new URL(
    "magick.wasm",
    import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.30"),
  ),
);

await initializeImageMagick(wasmBytes);

// Function to upload to Bunny.net storage
async function uploadToBunnyStorage(imageData, fileName) {
  try {
    const fileStream = fs.createReadStream(imageData);
    const response = await fetch(`${BUNNY_STORAGE_URL}/${fileName}`, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'image/webp'
      },
      body: imageData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return `${BUNNY_STORAGE_URL}/${fileName}`;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Be more specific in production
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const content = await file.arrayBuffer();
    
    let result = await ImageMagick.read(
      new Uint8Array(content),
      (img) => {
        // Resize to 352x198
        img.resize(352, 198);
        
        // Convert to WebP format
        return img.write(
          (data) => data,
          MagickFormat.Webp
        );
      },
    );

    // Generate a unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
    
    // Upload to Bunny.net storage
    const uploadUrl = await uploadToBunnyStorage(result, fileName);

    return new Response(
      JSON.stringify({ success: true, url: uploadUrl }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
        status: 500
      }
    );
  }
});