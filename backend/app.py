import os
import json
import pandas as pd
import geopandas as gpd
from flask import Flask, request, jsonify
from flask_cors import CORS
from shapely.geometry import Point

app = Flask(__name__)
CORS(app)  # Allow all origins for cross-service communication

# Load Data
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

city_gdf, areas_gdf = load_geodata()

@app.route('/', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Delhi Business Intelligence Backend",
        "version": "2.0"
    })

@app.route('/predict', methods=['POST'])
def predict_feasibility():
    """Business Feasibility Analysis"""
    try:
        data = request.json
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        budget = float(data.get('investment', 0))
        business_type = data.get('type', 'Restaurant')
        
        # Spatial analysis
        point = Point(lng, lat)
        location_score = 50
        area_name = "Unknown Zone"
        
        if areas_gdf is not None:
            contained = areas_gdf[areas_gdf.contains(point)]
            if not contained.empty:
                area_name = contained.iloc[0].get('name', 'Delhi Area')
                # Score based on area properties (enhance with your logic)
                location_score = 75
        
        # Financial projections
        estimated_revenue = budget * 0.45
        risk_level = "Medium"
        
        if location_score > 80: 
            risk_level = "Low"
        elif location_score < 40: 
            risk_level = "High"
        
        break_even = round(budget / (estimated_revenue * 0.2), 1) if estimated_revenue > 0 else 0
        
        return jsonify({
            "status": "success",
            "analysis": {
                "area_name": area_name,
                "risk_score": 100 - location_score,
                "risk_label": risk_level,
                "projected_revenue": estimated_revenue,
                "break_even_months": break_even,
                "yearly_growth": "12%",
                "location_score": location_score
            }
        })
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/analyze', methods=['POST'])
def unified_analysis():
    """
    Unified endpoint that mimics Maps Reimagined API
    This allows the frontend to call both services through one backend
    """
    try:
        data = request.json
        location = data.get('location', {})
        lat = float(location.get('lat'))
        lng = float(location.get('lng'))
        budget = float(data.get('budget', 0))
        business_type = data.get('businessType', 'Restaurant')
        
        # Calculate area metrics
        point = Point(lng, lat)
        area_score = 65  # Base score
        traffic_level = "Medium"
        accessibility = "Good"
        
        if areas_gdf is not None:
            contained = areas_gdf[areas_gdf.contains(point)]
            if not contained.empty:
                area_score = 82
                traffic_level = "High"
                accessibility = "Excellent"
        
        # Generate recommendations
        recommendations = [
            f"This area shows {traffic_level.lower()} foot traffic for {business_type} businesses",
            f"Accessibility rating: {accessibility}",
            "Consider proximity to metro stations and parking facilities",
            "Local competition analysis suggests moderate saturation"
        ]
        
        return jsonify({
            "status": "success",
            "areaScore": area_score,
            "trafficLevel": traffic_level,
            "accessibility": accessibility,
            "recommendations": recommendations,
            "locationInsights": {
                "population_density": "High",
                "commercial_activity": "Active",
                "public_transport": "Well Connected"
            }
        })
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
