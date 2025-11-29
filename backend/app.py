import os
import json
import pandas as pd
import geopandas as gpd
from flask import Flask, request, jsonify
from flask_cors import CORS
from shapely.geometry import Point

app = Flask(__name__)
CORS(app)  # Allow Frontend to call this

# Load Data (Ensure these files exist in backend/data/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

def load_geodata():
    try:
        # Load your specific GeoJSONs
        city = gpd.read_file(os.path.join(DATA_DIR, 'delhi_city.geojson'))
        areas = gpd.read_file(os.path.join(DATA_DIR, 'delhi_area.geojson'))
        return city, areas
    except Exception as e:
        print(f"Error loading data: {e}")
        return None, None

city_gdf, areas_gdf = load_geodata()

@app.route('/predict', methods=['POST'])
def predict_feasibility():
    data = request.json
    lat = data.get('lat')
    lng = data.get('lng')
    budget = float(data.get('investment', 0))
    
    # 1. Identify Location Context (Spatial Join)
    point = Point(lng, lat)
    location_score = 50 # Default neutral
    area_name = "Unknown Zone"
    
    if areas_gdf is not None:
        # Check which polygon contains the point
        contained = areas_gdf[areas_gdf.contains(point)]
        if not contained.empty:
            # Assume your geojson has a 'risk_score' or calculate one
            # This is a placeholder logic based on your previous 'RiskAssessment'
            area_name = contained.iloc[0].get('name', 'Delhi Area')
            # Mocking a risk calculation based on area properties
            location_score = 75 # Assume prime area for demo
            
    # 2. Financial Projection Logic (Simplified)
    # Revenue = (Base Traffic * Conversion) * Avg Ticket
    estimated_revenue = budget * 0.45  # Simple ROI model for demo
    risk_level = "Medium"
    
    if location_score > 80: risk_level = "Low"
    if location_score < 40: risk_level = "High"

    return jsonify({
        "status": "success",
        "analysis": {
            "area_name": area_name,
            "risk_score": 100 - location_score, # Risk is inverse of quality
            "risk_label": risk_level,
            "projected_revenue": estimated_revenue,
            "break_even_months": round(budget / (estimated_revenue * 0.2), 1),
            "yearly_growth": "12%"
        }
    })

@app.route('/', methods=['GET'])
def health():
    return "Delhi Business Backend is Running!"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
