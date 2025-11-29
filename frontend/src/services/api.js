import { GoogleGenerativeAI } from "@google/generative-ai";

// API Configuration
export const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'https://your-backend-service.onrender.com'
};

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
  } catch (e) { return []; }
};

// 2. OpenStreetMap Competitors
export const fetchCompetitors = async (lat, lng, type) => {
  try {
    const typeMap = { 'Restaurant': 'amenity=restaurant', 'Cafe': 'amenity=cafe', 'Gym': 'leisure=fitness_centre', 'Pharmacy': 'amenity=pharmacy', 'Hotel': 'tourism=hotel' };
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
  } catch (e) { return []; }
};

// 3. Gemini Analysis
export const analyzeWithGemini = async (apiKey, type, lat, lng, locationName, competitors) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const compNames = competitors.map(c => c.name).join(", ");
  const prompt = `Act as a Business Strategist. I'm opening a ${type} at ${locationName} (${lat},${lng}). 
  Real competitors nearby: [${compNames}].
  
  Return valid JSON:
  {
    "summary": "2 sentence strategic summary",
    "swot": { "strengths": ["s1","s2"], "weaknesses": ["w1","w2"] },
    "market_grade": "A/B/C",
    "competitors_enriched": [
       // Enrich the list I gave you with estimated rating (3.5-4.8) and address
       { "name": "competitor name", "rating": 4.5, "address": "Short address" }
    ]
  }`;

  const res = await model.generateContent(prompt);
  const text = res.response.text();
  return JSON.parse(text.replace(/```json|```/g, '').trim());
};
