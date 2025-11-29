import React, { useState, useEffect } from 'react';
import Map, { NavigationControl, Marker, Popup, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapPin, Search, Loader2, TrendingUp, AlertTriangle, Key, DollarSign, Building2 } from 'lucide-react';
import * as API from './services/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function App() {
  const [inputs, setInputs] = useState({ query: '', type: 'Restaurant', budget: '2000000', apiKey: '' });
  const [suggestions, setSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('scout'); 
  
  const [scoutData, setScoutData] = useState(null);
  const [predictData, setPredictData] = useState(null);
  const [mapPins, setMapPins] = useState([]);
  const [geoData, setGeoData] = useState({ city: null, area: null });

  // Load Map Polygons
  useEffect(() => {
    const fetchGeoData = async () => {
      try {
        const [cityRes, areaRes] = await Promise.all([
           fetch('/delhi_city.geojson'), 
           fetch('/delhi_area.geojson') 
        ]);
        setGeoData({ city: await cityRes.json(), area: await areaRes.json() });
      } catch (e) { console.error("Map Data Load Error:", e); }
    };
    fetchGeoData();
  }, []);

  const handleSearch = async (q) => {
    setInputs(prev => ({ ...prev, query: q }));
    if(q.length > 2) {
        const results = await API.searchLocationName(q);
        setSuggestions(results);
    }
  };

  const handleSelect = (item) => {
    setSelectedLocation({ lat: item.lat, lng: item.lon, name: item.name });
    setInputs(prev => ({ ...prev, query: item.name }));
    setSuggestions([]);
  };

  const runAnalysis = async () => {
    if(!selectedLocation || !inputs.apiKey) return alert("Location and API Key required!");
    setLoading(true);
    setScoutData(null);
    setPredictData(null);

    try {
      const [osmCompetitors, flaskResponse] = await Promise.all([
        API.fetchCompetitors(selectedLocation.lat, selectedLocation.lng, inputs.type),
        fetch(`${BACKEND_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                lat: selectedLocation.lat, 
                lng: selectedLocation.lng, 
                investment: inputs.budget,
                type: inputs.type 
            })
        }).then(r => r.json())
      ]);

      const geminiAnalysis = await API.analyzeWithGemini(
        inputs.apiKey, inputs.type, selectedLocation.lat, selectedLocation.lng, selectedLocation.name, osmCompetitors
      );

      const finalPins = osmCompetitors.map(real => {
         const aiInfo = geminiAnalysis.competitors_enriched?.find(ai => ai.name === real.name) || {};
         return { ...real, ...aiInfo };
      });

      setMapPins(finalPins);
      setScoutData({ ...geminiAnalysis, finalPins });
      setPredictData(flaskResponse.analysis);

    } catch (e) {
      console.error(e);
      alert("Analysis failed. Check API Key or Backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-[450px] flex flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur z-20 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Delhi Business Suite
          </h1>
          <p className="text-xs text-slate-400 mt-1">Integrated Market Intelligence</p>
        </div>

        <div className="p-6 space-y-4 border-b border-slate-800 bg-slate-900">
           <div className="relative">
             <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500"/>
             <input type="password" placeholder="Gemini API Key" value={inputs.apiKey} 
               onChange={e => setInputs({...inputs, apiKey: e.target.value})}
               className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
             />
           </div>

           <div className="relative">
             <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500"/>
             <input type="text" placeholder="Search Location (e.g. Connaught Place)" value={inputs.query}
               onChange={e => handleSearch(e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
             />
             {suggestions.length > 0 && (
               <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl cursor-pointer">
                 {suggestions.map((s,i) => (
                   <div key={i} onClick={() => handleSelect(s)} className="p-2 hover:bg-slate-700 text-sm px-4">
                     {s.name}
                   </div>
                 ))}
               </div>
             )}
           </div>

           <div className="flex gap-2">
             <select value={inputs.type} onChange={e => setInputs({...inputs, type: e.target.value})} 
                className="bg-slate-800 border border-slate-700 rounded-lg text-sm px-3 py-2 flex-1 outline-none">
                {['Restaurant', 'Cafe', 'Gym', 'Hotel', 'Pharmacy'].map(t => <option key={t}>{t}</option>)}
             </select>
             <input type="number" placeholder="Budget" value={inputs.budget} 
                onChange={e => setInputs({...inputs, budget: e.target.value})}
                className="bg-slate-800 border border-slate-700 rounded-lg text-sm px-3 py-2 w-28 outline-none" 
             />
           </div>

           <button onClick={runAnalysis} disabled={loading} 
             className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-all flex justify-center items-center gap-2">
             {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Search className="w-4 h-4"/>}
             Analyze Feasibility
           </button>
        </div>

        {scoutData && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex border-b border-slate-800">
              <button onClick={() => setActiveTab('scout')} 
                className={`flex-1 py-3 text-sm font-medium ${activeTab==='scout' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200'}`}>
                🗺️ Competitor Scout
              </button>
              <button onClick={() => setActiveTab('predict')} 
                className={`flex-1 py-3 text-sm font-medium ${activeTab==='predict' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'}`}>
                📈 Feasibility Logic
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'scout' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">AI Summary</h3>
                    <p className="text-sm text-slate-200 italic">"{scoutData.summary}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-xs"><TrendingUp size={14}/> STRENGTHS</div>
                      <ul className="list-disc list-inside text-[11px] text-slate-300">
                        {scoutData.swot.strengths.slice(0,3).map((s,i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs"><AlertTriangle size={14}/> WEAKNESSES</div>
                      <ul className="list-disc list-inside text-[11px] text-slate-300">
                        {scoutData.swot.weaknesses.slice(0,3).map((w,i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Top Competitors</h3>
                    {scoutData.finalPins.map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-3 mb-2 bg-slate-800 rounded-lg border border-slate-700">
                        <div>
                          <div className="font-medium text-sm text-white">{c.name}</div>
                          <div className="text-xs text-slate-500 truncate w-40">{c.address || "Address Unavailable"}</div>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded">
                          <span className="text-yellow-400 text-xs">★</span>
                          <span className="text-xs font-bold">{c.rating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'predict' && predictData && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                      <p className="text-xs text-slate-400 uppercase">Risk Level</p>
                      <p className={`text-2xl font-bold ${predictData.risk_label === 'High' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {predictData.risk_label}
                      </p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                      <p className="text-xs text-slate-400 uppercase">ROI (Months)</p>
                      <p className="text-2xl font-bold text-blue-400">{predictData.break_even_months}</p>
                    </div>
                  </div>

                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400"/> Projected Revenue
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Y1', val: predictData.projected_revenue },
                          { name: 'Y2', val: predictData.projected_revenue * 1.12 },
                          { name: 'Y3', val: predictData.projected_revenue * 1.25 }
                        ]}>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12}/>
                          <YAxis stroke="#64748b" fontSize={12}/>
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1e293b', border: 'none'}}/>
                          <Bar dataKey="val" fill="#10b981" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">3-Year Growth Projection</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MAP AREA */}
      <div className="flex-1 relative bg-black">
        {selectedLocation ? (
          <Map
            initialViewState={{ longitude: selectedLocation.lng, latitude: selectedLocation.lat, zoom: 13 }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" />
            
            <Marker longitude={selectedLocation.lng} latitude={selectedLocation.lat} anchor="bottom">
              <div className="relative">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-bounce" />
                <div className="w-8 h-2 bg-black/50 absolute -bottom-1 left-1/2 -translate-x-1/2 blur-sm rounded-full"/>
              </div>
            </Marker>

            {mapPins.map((p, i) => (
              <Marker key={i} longitude={p.lon} latitude={p.lat} anchor="bottom">
                <MapPin className="w-6 h-6 text-red-500 fill-red-900/50 drop-shadow-md hover:scale-110 transition-transform cursor-pointer"/>
              </Marker>
            ))}

            {/* Map Polygons */}
            {geoData.city && (
              <Source id="delhi-city" type="geojson" data={geoData.city}>
                <Layer id="city-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.05 }} />
              </Source>
            )}
            {geoData.area && (
              <Source id="delhi-area" type="geojson" data={geoData.area}>
                <Layer id="area-line" type="line" paint={{ 'line-color': '#34d399', 'line-width': 1, 'line-opacity': 0.3 }} />
              </Source>
            )}
          </Map>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-600">
            <Building2 className="w-20 h-20 opacity-20 mb-4"/>
            <p>Select a location to begin analysis</p>
          </div>
        )}
      </div>

    </div>
  );
}
