import React, { useState, useEffect } from 'react';
import Map, { NavigationControl, Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { MapPin, Search, Loader2, TrendingUp, AlertTriangle, DollarSign, Building2, Map as MapIcon, Calendar, Target } from 'lucide-react';
import * as API from './services/api';
import { API_CONFIG } from './services/api';

const BACKEND_URL = API_CONFIG.BACKEND_URL;

export default function App() {
  const [inputs, setInputs] = useState({ 
    query: '', 
    type: 'Restaurant', 
    budget: '2000000',  
  });
  
  const [suggestions, setSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('business');
  
  const [scoutData, setScoutData] = useState(null);
  const [predictData, setPredictData] = useState(null);
  const [mapPins, setMapPins] = useState([]);
  const [geoData, setGeoData] = useState({ city: null, area: null });

  useEffect(() => {
    const fetchGeoData = async () => {
      try {
        const [cityRes, areaRes] = await Promise.all([
          fetch('/delhi_city.geojson'), 
          fetch('/delhi_area.geojson')
        ]);
        if(cityRes.ok && areaRes.ok) {
          setGeoData({ city: await cityRes.json(), area: await areaRes.json() });
        }
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
    if(!selectedLocation {
      return alert("Please Select a Location");
    }
    
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
        }).then(r => r.json()).catch(() => ({ analysis: null }))
      ]);

      // DEBUG LOGGING
      console.log('🎯 Location sent to backend:', {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        type: inputs.type
      });

      console.log('📊 Backend response:', flaskResponse);

      if (flaskResponse?.analysis) {
        console.log('✅ Events found:', flaskResponse.analysis.events?.length || 0);
        console.log('   Positive:', flaskResponse.analysis.positive_count);
        console.log('   Negative:', flaskResponse.analysis.negative_count);
        console.log('   Risk Score:', flaskResponse.analysis.risk_score);
      } else {
        console.error('❌ No analysis data received from backend');
      }

      const geminiAnalysis = await API.analyzeWithGemini(
        inputs.type, selectedLocation.lat, selectedLocation.lng, selectedLocation.name, osmCompetitors
      );

      const finalPins = osmCompetitors.length > 0 
        ? osmCompetitors.map(real => {
            const aiInfo = geminiAnalysis.competitors_enriched?.find(ai => ai.name === real.name) || {};
            return { ...real, ...aiInfo };
          })
        : [];

      setMapPins(finalPins);
      setScoutData({ ...geminiAnalysis, finalPins });
      setPredictData(flaskResponse?.analysis || null);

    } catch (e) {
      console.error(e);
      alert("Analysis failed. Please check your configuration.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score < 30) return 'text-green-600';
    if (score < 50) return 'text-yellow-600';
    if (score < 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskBgColor = (score) => {
    if (score < 30) return 'bg-green-50 border-green-500';
    if (score < 50) return 'bg-yellow-50 border-yellow-500';
    if (score < 70) return 'bg-orange-50 border-orange-500';
    return 'bg-red-50 border-red-500';
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-[450px] flex flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur z-20 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Delhi Business Intelligence Suite
          </h1>
          <p className="text-xs text-slate-400 mt-1">Unified Market Analysis Platform</p>
        </div>

        <div className="p-6 space-y-4 border-b border-slate-800 bg-slate-900">

          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500"/>
            <input type="text" placeholder="Search Location (e.g. Sarojini Nagar)" value={inputs.query}
              onChange={e => handleSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {suggestions.map((s,i) => (
                  <div key={i} onClick={() => handleSelect(s)} className="p-3 hover:bg-slate-700 text-sm cursor-pointer border-b border-slate-700/50 last:border-0">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500 truncate">{s.fullName}</div>
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
            <input type="number" placeholder="Budget (₹)" value={inputs.budget} 
              onChange={e => setInputs({...inputs, budget: e.target.value})}
              className="bg-slate-800 border border-slate-700 rounded-lg text-sm px-3 py-2 w-32 outline-none" 
            />
          </div>

          <button onClick={runAnalysis} disabled={loading} 
            className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-medium py-3 rounded-lg transition-all flex justify-center items-center gap-2 shadow-lg">
            {loading ? <><Loader2 className="animate-spin w-4 h-4"/> Analyzing...</> : <><Search className="w-4 h-4"/> Run Complete Analysis</>}
          </button>
        </div>

        {/* RESULTS TABS */}
        {(scoutData || predictData) && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex border-b border-slate-800">
              <button onClick={() => setActiveTab('business')} 
                className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab==='business' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200'}`}>
                <Building2 className="w-4 h-4 inline mr-2"/> Business Intel
              </button>
              <button onClick={() => setActiveTab('predict')} 
                className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab==='predict' ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'}`}>
                <TrendingUp className="w-4 h-4 inline mr-2"/> Predictions
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* BUSINESS INTEL TAB */}
              {activeTab === 'business' && scoutData && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">AI Strategic Summary</h3>
                    <p className="text-sm text-slate-200 italic">"{scoutData.summary}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-xs">
                        <TrendingUp size={14}/> STRENGTHS
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                        {scoutData.swot.strengths.slice(0,3).map((s,i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs">
                        <AlertTriangle size={14}/> WEAKNESSES
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                        {scoutData.swot.weaknesses.slice(0,3).map((w,i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-3">Nearby Competitors</h3>
                    {scoutData.finalPins.length > 0 ? (
                      scoutData.finalPins.map((c, i) => (
                        <div key={i} className="flex justify-between items-center p-3 mb-2 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-all">
                          <div>
                            <div className="font-medium text-sm text-white">{c.name}</div>
                            <div className="text-xs text-slate-500 truncate w-48">{c.address || "Address Unavailable"}</div>
                          </div>
                          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded">
                            <span className="text-yellow-400 text-xs">★</span>
                            <span className="text-xs font-bold">{c.rating}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic p-4 text-center bg-slate-800/30 rounded-lg">
                        No competitor data available
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PREDICTIONS TAB */}
              {activeTab === 'predict' && predictData && (
                <div className="space-y-6 animate-fade-in">
                  {/* Risk Assessment Section */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
                    <h2 className="text-xl font-bold text-white mb-4">Risk Assessment</h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                      <div className={`col-span-1 border-l-4 p-4 rounded-lg ${getRiskBgColor(predictData.risk_score)}`}>
                        <p className="text-gray-600 text-sm mb-1">Overall Risk Score</p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-5xl font-bold ${getRiskColor(predictData.risk_score)}`}>
                            {predictData.risk_score}%
                          </span>
                          <span className={`text-lg font-semibold ${getRiskColor(predictData.risk_score)}`}>
                            {predictData.risk_label} Risk
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 px-4 py-4 rounded-lg border border-green-200">
                        <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-1" />
                        <p className="text-sm text-gray-600 text-center mb-1">Positive Events</p>
                        <p className="text-4xl font-bold text-green-600 text-center">{predictData.positive_count}</p>
                      </div>
                      
                      <div className="bg-red-50 px-4 py-4 rounded-lg border border-red-200">
                        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-1" />
                        <p className="text-sm text-gray-600 text-center mb-1">Negative Events</p>
                        <p className="text-4xl font-bold text-red-600 text-center">{predictData.negative_count}</p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-500/10 border-l-4 border-blue-400 p-3 rounded-lg">
                      <p className="text-xs font-semibold text-blue-300 mb-1">Risk Calculation Formula:</p>
                      <p className="text-xs text-blue-200 font-mono">{predictData.formula}</p>
                    </div>
                  </div>

                  {/* Future Impact Events */}
                  {predictData.events && predictData.events.length > 0 && (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
                      <h2 className="text-xl font-bold text-white mb-4">
                        Future Impact Events ({predictData.events.length})
                      </h2>
                      
                      <div className="space-y-3">
                        {predictData.events.map((event, idx) => (
                          <div key={idx} className={`border-l-4 p-4 rounded-lg transition-all ${
                            event.impact?.sentiment === 'POSITIVE' 
                              ? 'border-green-500 bg-green-500/10' 
                              : 'border-red-500 bg-red-500/10'
                          }`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-base text-white mb-2">{event.name}</h3>
                                <p className="text-xs text-slate-300 mb-3">{event.description}</p>
                                
                                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-2">
                                  {event.timelines?.impact_start && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-blue-400" />
                                      <span>Impact: {new Date(event.timelines.impact_start).toLocaleDateString('en-IN', {month: 'numeric', day: 'numeric', year: 'numeric'})}</span>
                                    </div>
                                  )}
                                  {event.location?.area_name && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-blue-400" />
                                      <span>{event.location.area_name}</span>
                                    </div>
                                  )}
                                  {event.distance_km && (
                                    <div className="text-slate-500">{event.distance_km} km away</div>
                                  )}
                                </div>
                                
                                <div className="flex gap-2">
                                  {event.status && (
                                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">
                                      {event.status}
                                    </span>
                                  )}
                                  {event.type && (
                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                                      {event.type.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className={`text-right min-w-[80px] ${
                                event.impact?.sentiment === 'POSITIVE' ? 'text-green-400' : 'text-red-400'
                              }`}>
                                <p className="text-3xl font-bold">
                                  {event.impact?.sentiment === 'POSITIVE' ? '+' : ''}
                                  {Math.round((event.impact?.score || 0) * 100)}%
                                </p>
                                <p className="text-xs mt-1 font-medium">Impact Score</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 10-Year Success Projection */}
                  {predictData.projection_data && predictData.projection_data.length > 0 && (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
                      <h2 className="text-xl font-bold text-white mb-4">10-Year Success Projection</h2>
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg mb-4">
                        <p className="text-xs text-indigo-200">
                          This projection accounts for the timing and decay of impact from all identified future events.
                          Success probability adjusts as events materialize and their effects diminish over time.
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={predictData.projection_data}>
                          <defs>
                            <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="year" stroke="#9CA3AF" style={{ fontSize: '11px' }} />
                          <YAxis domain={[0, 100]} stroke="#9CA3AF" style={{ fontSize: '11px' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                          <Area type="monotone" dataKey="probability" stroke="#10b981" strokeWidth={2} fill="url(#colorProb)" name="Success Probability (%)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Recommendations */}
                  {predictData.risk_score > 40 && (
                    <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-xl p-6 border-2 border-orange-500/30">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-orange-400" />
                        <h2 className="text-xl font-bold text-white">Recommendations</h2>
                      </div>
                      
                      {predictData.alternatives && predictData.alternatives.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-base font-semibold mb-3 text-slate-200 flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-400"/> Alternative Locations (Lower Risk)
                          </h3>
                          <div className="grid grid-cols-1 gap-3">
                            {predictData.alternatives.map((alt, idx) => (
                              <div key={idx} className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 hover:border-blue-400 transition-all cursor-pointer">
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-semibold text-blue-300 text-base">{alt.area}</h4>
                                  <span className="bg-green-500/20 text-green-300 text-xs font-bold px-2 py-1 rounded-full">
                                    {alt.risk}% Risk
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mb-2">{alt.reason}</p>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>PIN: {alt.pincode}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {predictData.alternate_businesses && predictData.alternate_businesses.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold mb-3 text-slate-200">
                            💡 Alternative Business Types for This Location
                          </h3>
                          <div className="space-y-2">
                            {predictData.alternate_businesses.map((biz, idx) => (
                              <div key={idx} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-600 hover:border-blue-400 transition-all">
                                <div className="bg-blue-500/20 p-2 rounded-lg">
                                  <Building2 className="w-4 h-4 text-blue-300" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-white text-sm">{biz.type}</p>
                                  <p className="text-xs text-slate-400 mt-1">{biz.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Success Message for Low Risk */}
                  {predictData.risk_score <= 40 && (
                    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-6 border-2 border-green-500/30 text-center">
                      <div className="text-green-400 text-6xl mb-3">✓</div>
                      <h3 className="text-2xl font-bold text-white mb-2">Great Choice!</h3>
                      <p className="text-slate-300">
                        This location shows favorable conditions for your {inputs.type} business.
                        The risk score of {predictData.risk_score}% indicates good growth potential.
                      </p>
                    </div>
                  )}
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
            <p className="text-lg">Select a location to begin unified analysis</p>
            <p className="text-sm text-slate-700 mt-2">Business Intelligence + Predictions in one platform</p>
          </div>
        )}
      </div>
    </div>
  );
}
