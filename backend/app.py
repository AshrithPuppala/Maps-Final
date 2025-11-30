import os
import json
import math
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from shapely.geometry import Point
import geopandas as gpd

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

def load_geodata():
    try:
        city = gpd.read_file(os.path.join(DATA_DIR, 'delhi_city.geojson'))
        areas = gpd.read_file(os.path.join(DATA_DIR, 'delhi_area.geojson'))
        return city, areas
    except Exception as e:
        print(f"Error loading geodata: {e}")
        return None, None

def load_future_events():
    try:
        with open(os.path.join(DATA_DIR, 'delhi_future_events.json'), 'r') as f:
            events = json.load(f)
            print(f"✓ Successfully loaded {len(events)} future events")
            # Debug: print first event
            if events:
                print(f"Sample event: {events[0]['name']} at ({events[0]['location']['lat']}, {events[0]['location']['lng']})")
            return events
    except Exception as e:
        print(f"❌ Error loading future events: {e}")
        return []

city_gdf, areas_gdf = load_geodata()
FUTURE_EVENTS = load_future_events()

# Delhi areas fallback
DELHI_AREAS = [
    {'name': 'Connaught Place', 'lat': 28.6315, 'lng': 77.2167},
    {'name': 'Karol Bagh', 'lat': 28.6519, 'lng': 77.1900},
    {'name': 'Saket', 'lat': 28.5244, 'lng': 77.2066},
    {'name': 'Dwarka', 'lat': 28.5921, 'lng': 77.0460},
    {'name': 'Rohini', 'lat': 28.7496, 'lng': 77.0669},
    {'name': 'Sarojini Nagar', 'lat': 28.5753, 'lng': 77.1953},
]

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters"""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def geocode_location(area_name):
    """Get coordinates from area name"""
    area_lower = area_name.lower()
    for area in DELHI_AREAS:
        if area_lower in area['name'].lower() or area['name'].lower() in area_lower:
            return area['lat'], area['lng']
    return 28.6139, 77.2090  # Default: Connaught Place

def calculate_risk_score(positive_impacts, negative_impacts, location_factor):
    """Calculate risk score using the formula"""
    base_risk = 50
    
    # Calculate average impact scores
    avg_positive = sum([abs(e['impact']['score']) for e in positive_impacts]) / len(positive_impacts) if positive_impacts else 0
    avg_negative = sum([abs(e['impact']['score']) for e in negative_impacts]) / len(negative_impacts) if negative_impacts else 0
    
    # Apply formula: Base + (Negative * 40) - (Positive * 30) + Location
    risk = base_risk + (avg_negative * 40) - (avg_positive * 30) + location_factor
    
    # Clamp between 0 and 100
    risk = max(0, min(100, risk))
    
    print(f"📊 Risk Calculation:")
    print(f"   Base: {base_risk}, Pos: {len(positive_impacts)} (avg={avg_positive:.2f}), Neg: {len(negative_impacts)} (avg={avg_negative:.2f})")
    print(f"   Final Risk: {risk:.2f}%")
    
    return round(risk, 2)

def generate_10year_projection(events, base_success_rate=60):
    """Generate 10-year success probability projection"""
    current_year = datetime.now().year
    projection = []
    
    for year_offset in range(11):
        year = current_year + year_offset
        success_prob = base_success_rate
        
        for event in events:
            try:
                impact_year = datetime.fromisoformat(event['timelines']['impact_start'].replace('Z', '')).year
                if year >= impact_year:
                    years_after_impact = year - impact_year
                    decay_factor = math.exp(-0.1 * years_after_impact)
                    impact_contribution = event['impact']['score'] * 30 * decay_factor
                    success_prob += impact_contribution
            except:
                pass
        
        success_prob = max(20, min(95, success_prob))
        projection.append({
            'year': year,
            'probability': round(success_prob, 1),
            'risk': round(100 - success_prob, 1)
        })
    
    return projection

def find_alternative_locations(current_risk):
    """Suggest alternative locations with lower risk"""
    alternatives = [
        {'area': 'Connaught Place', 'pincode': '110001', 'risk': 25, 
         'reason': 'High footfall, established commercial hub'},
        {'area': 'Dwarka Sector 10', 'pincode': '110075', 'risk': 28,
         'reason': 'New residential development, growing population'},
        {'area': 'Saket', 'pincode': '110017', 'risk': 30,
         'reason': 'Affluent residential area with strong retail demand'},
    ]
    return [alt for alt in alternatives if alt['risk'] < current_risk][:3]

def suggest_alternative_businesses(business_type):
    """Suggest alternative business types"""
    alternatives = {
        'restaurant': [
            {'type': 'Cloud Kitchen', 'reason': 'Lower overhead, delivery-focused model'},
            {'type': 'Co-working Space', 'reason': 'Growing remote work culture'}
        ],
        'cafe': [
            {'type': 'Cloud Kitchen', 'reason': 'Lower overhead, delivery-focused model'},
            {'type': 'Co-working Space', 'reason': 'Growing remote work culture'}
        ],
    }
    
    business_lower = business_type.lower()
    for key in alternatives:
        if key in business_lower:
            return alternatives[key]
    return []

@app.route('/', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Delhi Business Intelligence Backend",
        "version": "3.0",
        "events_loaded": len(FUTURE_EVENTS),
        "data_dir": DATA_DIR,
        "data_dir_exists": os.path.exists(DATA_DIR),
        "json_file_path": os.path.join(DATA_DIR, 'delhi_future_events.json'),
        "json_file_exists": os.path.exists(os.path.join(DATA_DIR, 'delhi_future_events.json'))
    })

@app.route('/debug/events', methods=['GET'])
def debug_events():
    """Debug endpoint to check events data"""
    return jsonify({
        "total_events": len(FUTURE_EVENTS),
        "events_summary": [
            {
                "name": e['name'],
                "location": e['location'],
                "radius": e['impact']['radius_meters'],
                "sentiment": e['impact']['sentiment']
            } for e in FUTURE_EVENTS
        ] if FUTURE_EVENTS else []
    })

@app.route('/predict', methods=['POST'])
def predict_feasibility():
    """Main prediction endpoint with full analysis"""
    try:
        data = request.json
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        budget = float(data.get('investment', 0))
        business_type = data.get('type', 'Restaurant')
        
        print(f"\n🎯 Analyzing location: ({lat}, {lng}) for {business_type}")
        print(f"📍 Checking against {len(FUTURE_EVENTS)} events...")
        
        # Find relevant events
        relevant_events = []
        for event in FUTURE_EVENTS:
            event_lat = event['location']['lat']
            event_lng = event['location']['lng']
            radius = event['impact']['radius_meters']
            
            distance = haversine_distance(lat, lng, event_lat, event_lng)
            
            print(f"   Event: {event['name']}")
            print(f"   Distance: {distance:.0f}m, Radius: {radius}m")
            
            if distance <= radius:
                event_copy = event.copy()
                event_copy['distance_meters'] = round(distance, 2)
                event_copy['distance_km'] = round(distance / 1000, 2)
                relevant_events.append(event_copy)
                print(f"   ✓ Event is within impact radius!")
            else:
                print(f"   ✗ Event is outside radius")
        
        print(f"\n✅ Found {len(relevant_events)} relevant events")
        
        # Separate positive and negative
        positive_impacts = [e for e in relevant_events if e['impact']['sentiment'] == 'POSITIVE']
        negative_impacts = [e for e in relevant_events if e['impact']['sentiment'] == 'NEGATIVE']
        
        print(f"   Positive: {len(positive_impacts)}, Negative: {len(negative_impacts)}")
        
        # Calculate risk
        location_factor = 0
        risk_score = calculate_risk_score(positive_impacts, negative_impacts, location_factor)
        
        if risk_score < 30:
            risk_level = "Low"
        elif risk_score < 50:
            risk_level = "Moderate"
        elif risk_score < 70:
            risk_level = "High"
        else:
            risk_level = "Very High"
        
        # Financial projections
        risk_multiplier = 1 - (risk_score / 200)
        estimated_revenue = budget * 0.45 * risk_multiplier
        break_even = round(budget / (estimated_revenue * 0.2), 1) if estimated_revenue > 0 else 0
        
        # 10-year projection
        projection_data = generate_10year_projection(relevant_events)
        
        # Alternatives
        alternatives = find_alternative_locations(risk_score) if risk_score > 40 else []
        alternate_businesses = suggest_alternative_businesses(business_type) if risk_score > 40 else []
        
        return jsonify({
            "status": "success",
            "analysis": {
                # Basic metrics
                "risk_score": risk_score,
                "risk_label": risk_level,
                "projected_revenue": estimated_revenue,
                "break_even_months": break_even,
                "yearly_growth": "12%",
                
                # Event data
                "events": relevant_events,
                "positive_count": len(positive_impacts),
                "negative_count": len(negative_impacts),
                
                # Projection
                "projection_data": projection_data,
                
                # Recommendations
                "alternatives": alternatives,
                "alternate_businesses": alternate_businesses,
                
                # Formula
                "formula": "Risk = 50 + (Avg_Negative × 40) - (Avg_Positive × 30) + Location_Factor"
            }
        })
    
    except Exception as e:
        print(f"❌ Error in prediction: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """Maps Reimagined compatible endpoint"""
    try:
        data = request.json
        business_type = data.get('businessType', '')
        location_data = data.get('location', {})
        
        if isinstance(location_data, dict):
            lat = location_data.get('lat')
            lng = location_data.get('lng')
            area_name = location_data.get('name', '')
        else:
            area_name = location_data
            lat, lng = geocode_location(area_name)
        
        # Call predict endpoint internally
        result = predict_feasibility()
        return result
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n🚀 Starting Delhi Business Intelligence Backend on port {port}")
    print(f"📊 Loaded {len(FUTURE_EVENTS)} events from database")
    app.run(host='0.0.0.0', port=port, debug=True)
