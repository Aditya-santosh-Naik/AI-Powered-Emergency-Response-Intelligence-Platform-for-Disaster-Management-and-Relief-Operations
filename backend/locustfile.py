"""Locust load and stress testing configuration for Disaster Response Platform APIs (Weeks 7-8).

Run via:
    locust -f locustfile.py --headless -u 50 -r 10 --run-time 1m --host http://localhost:8000
"""

from locust import HttpUser, between, task


class DisasterPlatformUser(HttpUser):
    wait_time = between(1.0, 3.0)

    @task(4)
    def test_get_events(self):
        self.client.get("/api/v1/events?limit=50")

    @task(3)
    def test_operations_overview(self):
        self.client.get("/api/v1/operations/overview")

    @task(2)
    def test_routing_calculation(self):
        self.client.get(
            "/api/v1/routing/route?origin_lat=28.6139&origin_lon=77.2090&dest_lat=19.0760&dest_lon=72.8777&road_accessibility=0.8"
        )

    @task(2)
    def test_routing_corridors(self):
        self.client.get("/api/v1/routing/corridors")

    @task(2)
    def test_inventory_summary(self):
        self.client.get("/api/v1/inventory/summary")

    @task(1)
    def test_predictions_status(self):
        self.client.get("/api/v1/predictions/status")

    @task(1)
    def test_list_missions(self):
        self.client.get("/api/v1/missions")

    @task(1)
    def test_list_allocation_plans(self):
        self.client.get("/api/v1/allocation/plans")
