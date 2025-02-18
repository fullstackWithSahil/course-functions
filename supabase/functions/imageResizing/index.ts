import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";

// Add Bunny.net storage configuration
const BUNNY_STORAGE_URL = "https://syd.storage.bunnycdn.com/buisnesstool-course";
const BUNNY_API_KEY = Deno.env.get('BUNNY_API_KEY')// Replace with your actual API key
console.log(BUNNY_API_KEY);

const wasmBytes = await Deno.readFile(
  new URL(
    "magick.wasm",
    import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.30"),
  ),
);

await initializeImageMagick(wasmBytes);

// Modified upload function to handle Uint8Array directly
async function uploadToBunnyStorage(imageData, fileName) {
  try {
    // Create a Blob from the Uint8Array
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

    return `${BUNNY_STORAGE_URL}/${fileName}`;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const uploadUrl = await uploadToBunnyStorage(result,key);

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