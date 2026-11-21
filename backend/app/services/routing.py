"""Geographic routing engine for disaster logistics using NetworkX and road accessibility."""

import math
from typing import Any

import networkx as nx

# Strategic Indian National Highway / Transit Corridors Network
# Major logistical nodes with verified (latitude, longitude)
CORRIDOR_WAYPOINTS = {
    "DELHI": (28.6139, 77.2090),
    "JAIPUR": (26.9124, 75.7873),
    "AHMEDABAD": (23.0225, 72.5714),
    "MUMBAI": (19.0760, 72.8777),
    "PUNE": (18.5204, 73.8567),
    "BENGALURU": (12.9716, 77.5946),
    "CHENNAI": (13.0827, 80.2707),
    "KOCHI": (9.9312, 76.2673),
    "HYDERABAD": (17.3850, 78.4867),
    "NAGPUR": (21.1458, 79.0882),
    "BHUBANESWAR": (20.2961, 85.8245),
    "KOLKATA": (22.5726, 88.3639),
    "SILIGURI": (26.7271, 88.3953),
    "GUWAHATI": (26.1445, 91.7362),
    "PATNA": (25.5941, 85.1376),
    "VARANASI": (25.3176, 82.9739),
    "LUCKNOW": (26.8467, 80.9462),
    "KANPUR": (26.4499, 80.3319),
    "BHOPAL": (23.2599, 77.4126),
    "INDORE": (22.7196, 75.8577),
    "RAIPUR": (21.2514, 81.6296),
    "VISAKHAPATNAM": (17.6868, 83.2185),
    "VIJAYAWADA": (16.5062, 80.6480),
    "MADURAI": (9.9252, 78.1198),
    "SHILLONG": (25.5788, 91.8933),
    "DEHRADUN": (30.3165, 78.0322),
    "CHANDIGARH": (30.7333, 76.7794),
    "AMRITSAR": (31.6340, 74.8723),
}

# Major corridor connections (National Highway Trunk Network)
CORRIDOR_EDGES = [
    ("DELHI", "CHANDIGARH"),
    ("CHANDIGARH", "AMRITSAR"),
    ("DELHI", "DEHRADUN"),
    ("DELHI", "JAIPUR"),
    ("JAIPUR", "AHMEDABAD"),
    ("AHMEDABAD", "MUMBAI"),
    ("MUMBAI", "PUNE"),
    ("PUNE", "BENGALURU"),
    ("BENGALURU", "KOCHI"),
    ("BENGALURU", "CHENNAI"),
    ("CHENNAI", "VIJAYAWADA"),
    ("VIJAYAWADA", "VISAKHAPATNAM"),
    ("VISAKHAPATNAM", "BHUBANESWAR"),
    ("BHUBANESWAR", "KOLKATA"),
    ("KOLKATA", "SILIGURI"),
    ("SILIGURI", "GUWAHATI"),
    ("GUWAHATI", "SHILLONG"),
    ("DELHI", "KANPUR"),
    ("KANPUR", "LUCKNOW"),
    ("KANPUR", "VARANASI"),
    ("VARANASI", "PATNA"),
    ("PATNA", "KOLKATA"),
    ("DELHI", "BHOPAL"),
    ("BHOPAL", "INDORE"),
    ("INDORE", "MUMBAI"),
    ("BHOPAL", "NAGPUR"),
    ("NAGPUR", "HYDERABAD"),
    ("HYDERABAD", "BENGALURU"),
    ("HYDERABAD", "VIJAYAWADA"),
    ("NAGPUR", "RAIPUR"),
    ("RAIPUR", "BHUBANESWAR"),
    ("CHENNAI", "MADURAI"),
    ("MADURAI", "KOCHI"),
]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two points in kilometers."""
    r = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class LogisticsRoutingEngine:
    """NetworkX-powered routing engine for emergency logistics and relief transport."""

    def __init__(self):
        self.graph = nx.Graph()
        self._build_corridor_graph()

    def _build_corridor_graph(self):
        """Construct weighted graph of strategic transport corridors."""
        for node_id, coords in CORRIDOR_WAYPOINTS.items():
            self.graph.add_node(node_id, lat=coords[0], lon=coords[1])

        for u, v in CORRIDOR_EDGES:
            lat_u, lon_u = CORRIDOR_WAYPOINTS[u]
            lat_v, lon_v = CORRIDOR_WAYPOINTS[v]
            # Road curvature multiplier ~ 1.2
            dist = haversine_distance(lat_u, lon_u, lat_v, lon_v) * 1.2
            self.graph.add_edge(u, v, weight=dist)

    def _find_nearest_waypoint(self, lat: float, lon: float) -> str:
        """Find the closest corridor hub to an arbitrary coordinate."""
        closest_node = None
        min_dist = float("inf")
        for node, data in self.graph.nodes(data=True):
            d = haversine_distance(lat, lon, data["lat"], data["lon"])
            if d < min_dist:
                min_dist = d
                closest_node = node
        return closest_node or "DELHI"

    def calculate_delivery_route(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        road_accessibility: float = 1.0,
    ) -> dict[str, Any]:
        """
        Compute delivery route, distance, transit duration, and GeoJSON LineString.

        Parameters:
            origin_lat, origin_lon: Coordinates of dispatch depot.
            dest_lat, dest_lon: Coordinates of disaster zone.
            road_accessibility: Accessibility factor in [0.0, 1.0].

        Returns:
            Dictionary containing distance_km, duration_hours, accessibility_status,
            and geojson LineString dictionary.
        """
        # Clamp accessibility
        acc = max(0.05, min(1.0, road_accessibility))

        # Classify status
        if acc >= 0.7:
            status = "Accessible"
        elif acc >= 0.3:
            status = "Restricted"
        else:
            status = "Inaccessible"

        # Direct haversine distance
        direct_dist = haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)

        # For very short distances (< 80 km), use direct path with road winding
        if direct_dist < 80.0:
            road_dist = direct_dist * 1.2
            waypoints = [
                [origin_lon, origin_lat],
                [(origin_lon + dest_lon) / 2.0, (origin_lat + dest_lat) / 2.0],
                [dest_lon, dest_lat],
            ]
        else:
            # Map through corridor network
            start_hub = self._find_nearest_waypoint(origin_lat, origin_lon)
            end_hub = self._find_nearest_waypoint(dest_lat, dest_lon)

            try:
                path = nx.shortest_path(
                    self.graph, source=start_hub, target=end_hub, weight="weight"
                )
            except Exception:
                path = [start_hub, end_hub]

            # Build full polyline coordinate sequence [lon, lat] for GeoJSON
            waypoints = [[origin_lon, origin_lat]]
            total_corridor_dist = 0.0

            # Origin to first hub
            hub0_coords = CORRIDOR_WAYPOINTS[path[0]]
            first_leg = haversine_distance(origin_lat, origin_lon, hub0_coords[0], hub0_coords[1]) * 1.15
            total_corridor_dist += first_leg

            for i in range(len(path)):
                node = path[i]
                lat, lon = CORRIDOR_WAYPOINTS[node]
                waypoints.append([lon, lat])
                if i > 0:
                    prev_lat, prev_lon = CORRIDOR_WAYPOINTS[path[i - 1]]
                    total_corridor_dist += haversine_distance(prev_lat, prev_lon, lat, lon) * 1.2

            # Last hub to destination
            hub_last_coords = CORRIDOR_WAYPOINTS[path[-1]]
            last_leg = haversine_distance(hub_last_coords[0], hub_last_coords[1], dest_lat, dest_lon) * 1.15
            total_corridor_dist += last_leg
            waypoints.append([dest_lon, dest_lat])

            road_dist = total_corridor_dist

        # Compute transit duration (Truck fleet base speed = 45 km/h, degraded if restricted)
        effective_speed = 45.0 * (0.5 + 0.5 * acc) if acc >= 0.3 else 18.0
        duration_hours = round(road_dist / effective_speed, 2)

        geojson_feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": waypoints,
            },
            "properties": {
                "distance_km": round(road_dist, 1),
                "duration_hours": duration_hours,
                "road_accessibility": round(acc, 2),
                "accessibility_status": status,
            },
        }

        return {
            "distance_km": round(road_dist, 1),
            "est_duration_hours": duration_hours,
            "road_accessibility": round(acc, 2),
            "accessibility_status": status,
            "geojson": geojson_feature,
        }


# Singleton instance
routing_engine = LogisticsRoutingEngine()

