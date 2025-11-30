import { GoogleGenerativeAI } from "@google/generative-ai";

// API Configuration
export const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'https://maps-final.onrender.com',
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || ''
};

// Debug: Log configuration (remove API key from logs for security)
console.log('🔧 API Configuration:', {
  BACKEND_URL: API_CONFIG.BACKEND_URL,
  GEMINI_API_KEY_SET: !!API_CONFIG.GEMINI_API_KEY,
  GEMINI_API_KEY_LENGTH: API_CONFIG.GEMINI_API_KEY?.length || 0
});

// 1. Nominatim Geocoding
export const searchLocationName = async (query) => {
  try {
    const q = query.toLowerCase().includes('delhi') ? query : `${query} Delhi`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=in`);
    const data = await res.json();
    return data.map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch (e) { 
    console.error("❌ Geocoding error:", e);
    return []; 
  }
};

// 2. OpenStreetMap Competitors
export const fetchCompetitors = async (lat, lng, type) => {
  try {
    const typeMap = { 
      'Restaurant': 'amenity=restaurant', 
      'Cafe': 'amenity=cafe', 
      'Gym': 'leisure=fitness_centre', 
      'Pharmacy': 'amenity=pharmacy', 
      'Hotel': 'tourism=hotel' 
    };
    const tag = typeMap[type] || 'amenity=restaurant';
    const query = `[out:json][timeout:25];(node[${tag}](around:3000,${lat},${lng});way[${tag}](around:3000,${lat},${lng}););out center 15;`;
    
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if(!res.ok) return [];
    const data = await res.json();
    return data.elements ? data.elements.map(p => ({
        name: p.tags?.name || "Unknown",
        lat: p.lat || p.center?.lat,
        lon: p.lon || p.center?.lon
    })).filter(p => p.name !== "Unknown").slice(0,10) : [];
  } catch (e) { 
    console.error("❌ Competitors fetch error:", e);
    return []; 
  }
};

// 3. Gemini Analysis
export const analyzeWithGemini = async (type, lat, lng, locationName, competitors) => {
  const apiKey = API_CONFIG.GEMINI_API_KEY;
  
  console.log('🤖 Attempting Gemini API call...');
  console.log('   API Key present:', !!apiKey);
  console.log('   API Key length:', apiKey?.length || 0);
  
  if (!apiKey || apiKey.trim() === '') {
    const errorMsg = `
⚠️ Gemini API Key Not Configured!

To fix this:
1. Go to Render Dashboard
2. Select 'delhi-business-frontend' service
3. Go to 'Environment' tab
4. Add environment variable:
   - Key: VITE_GEMINI_API_KEY
   - Value: Your Gemini API key (starts with AIza...)
5. Save and redeploy

Note: The key must be set BEFORE building, not after deployment.
    `;
    console.error(errorMsg);
    throw new Error("Gemini API key not configured in environment variables");
  }
  
  try {
    console.log('✅ Initializing Gemini API...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const compNames = competitors.map(c => c.name).join(", ");
    const prompt = `Act as a Business Strategist. I'm opening a ${type} at ${locationName} (${lat},${lng}). 
Real competitors nearby: [${compNames}].

Return valid JSON only, no markdown:
{
  "summary": "2 sentence strategic summary",
  "swot": { "strengths": ["s1","s2"], "weaknesses": ["w1","w2"] },
  "market_grade": "A/B/C",
  "competitors_enriched": [
     { "name": "competitor name", "rating": 4.5, "address": "Short address" }
  ]
}`;

    console.log('📤 Sending request to Gemini...');
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    console.log('📥 Received response from Gemini');
    
    const cleanText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    console.log('✅ Successfully parsed Gemini response');
    
    return parsed;
  } catch (error) {
    console.error("❌ Gemini API error:", error);
    console.error("Error details:", error.message);
    throw new Error(`Gemini analysis failed: ${error.message}`);
  }
};
