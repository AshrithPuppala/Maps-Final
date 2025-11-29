import json
import math

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters"""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Load events
with open('backend/data/delhi_future_events.json', 'r') as f:
    events = json.load(f)

print(f"✅ Loaded {len(events)} events\n")

# Test locations
test_locations = [
    {"name": "Dwarka", "lat": 28.5921, "lng": 77.0460},
    {"name": "Connaught Place", "lat": 28.6315, "lng": 77.2167},
    {"name": "Rohini", "lat": 28.7496, "lng": 77.0669},
    {"name": "Okhla", "lat": 28.5517, "lng": 77.2762},
]

for location in test_locations:
    print(f"📍 Testing: {location['name']} ({location['lat']}, {location['lng']})")
    print("="*70)
    
    found_events = []
    for event in events:
        distance = haversine_distance(
            location['lat'], location['lng'],
            event['location']['lat'], event['location']['lng']
        )
        
        if distance <= event['impact']['radius_meters']:
            found_events.append({
                'name': event['name'],
                'distance_km': round(distance/1000, 2),
                'sentiment': event['impact']['sentiment'],
                'score': event['impact']['score']
            })
    
    if found_events:
        print(f"✅ Found {len(found_events)} events:")
        for e in found_events:
            print(f"   • {e['name']} - {e['distance_km']}km away - {e['sentiment']} ({e['score']*100:+.0f}%)")
    else:
        print(f"❌ No events found within radius")
    
    print()

# Print all event locations for reference
print("\n📊 All Events in Database:")
print("="*70)
for event in events:
    print(f"{event['name']}")
    print(f"  Location: {event['location']['area_name']} ({event['location']['lat']}, {event['location']['lng']})")
    print(f"  Radius: {event['impact']['radius_meters']}m")
    print(f"  Impact: {event['impact']['sentiment']} ({event['impact']['score']*100:+.0f}%)")
    print()
