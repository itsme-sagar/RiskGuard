#!/usr/bin/env python3
"""
Comprehensive Backend Integration Test
Tests all API endpoints and WebSocket functionality
"""
import json
import time
import threading
import urllib.request
import urllib.error
import sys
import os

# Add backend path
sys.path.insert(0, os.path.dirname(__file__))

# Start server in a separate thread
from main import app
import uvicorn

SERVER_STARTED = False

def run_server():
    global SERVER_STARTED
    uvicorn.run(app, host='127.0.0.1', port=9000, log_level='error')
    SERVER_STARTED = True

# Start server in background thread
print("Starting FastAPI server...")
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

# Wait for server to be ready
print("Waiting for server to start...")
time.sleep(5)
print("Server should be ready now")

BASE_URL = "http://127.0.0.1:9000"
RESULTS = {}

def make_request(url, method="GET", data=None):
    """Make HTTP request and return response"""
    try:
        if method == "GET":
            req = urllib.request.Request(url)
        else:
            req = urllib.request.Request(url, data=json.dumps(data).encode(), method=method)
            req.add_header('Content-Type', 'application/json')

        with urllib.request.urlopen(req, timeout=10) as resp:
            return {
                "success": True,
                "status": resp.status,
                "data": json.loads(resp.read().decode())
            }
    except urllib.error.HTTPError as e:
        return {
            "success": False,
            "status": e.code,
            "error": e.read().decode()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def test_machines():
    """Test GET /api/machines"""
    print("\n[1] Testing GET /api/machines...")
    result = make_request(f"{BASE_URL}/api/machines")

    if result["success"] and result["status"] == 200:
        machines = result["data"]
        print(f"    Found {len(machines)} machines")
        if len(machines) >= 6:
            RESULTS["machines"] = "PASS"
            print("    PASS - 6 machines returned")
            return True

    RESULTS["machines"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_machine_detail():
    """Test GET /api/machines/1"""
    print("\n[2] Testing GET /api/machines/1...")
    result = make_request(f"{BASE_URL}/api/machines/1")

    if result["success"] and result["status"] == 200:
        machine = result["data"]
        print(f"    Machine: {machine.get('name', 'N/A')}")
        print(f"    Type: {machine.get('machine_type', 'N/A')}")
        RESULTS["machine_detail"] = "PASS"
        print("    PASS")
        return True

    RESULTS["machine_detail"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_readings():
    """Test GET /api/machines/1/readings"""
    print("\n[3] Testing GET /api/machines/1/readings...")
    result = make_request(f"{BASE_URL}/api/machines/1/readings")

    if result["success"] and result["status"] == 200:
        data = result["data"]
        print(f"    Readings count: {data.get('count', 0)}")
        if data.get('count', 0) > 0:
            RESULTS["readings"] = "PASS"
            print("    PASS")
            return True

    RESULTS["readings"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_prediction():
    """Test GET /api/machines/1/prediction"""
    print("\n[4] Testing GET /api/machines/1/prediction...")
    result = make_request(f"{BASE_URL}/api/machines/1/prediction")

    if result["success"] and result["status"] == 200:
        pred = result["data"]
        print(f"    Failure probability: {pred.get('failure_probability', 'N/A')}")
        print(f"    Predicted status: {pred.get('predicted_status', 'N/A')}")
        RESULTS["prediction"] = "PASS"
        print("    PASS")
        return True

    RESULTS["prediction"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_history():
    """Test GET /api/machines/1/history"""
    print("\n[5] Testing GET /api/machines/1/history...")
    result = make_request(f"{BASE_URL}/api/machines/1/history?hours=1")

    if result["success"] and result["status"] == 200:
        history = result["data"]
        print(f"    History records: {len(history)}")
        RESULTS["history"] = "PASS"
        print("    PASS")
        return True

    RESULTS["history"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_simulation():
    """Test simulation controls"""
    print("\n[6] Testing simulation controls...")

    # Start simulation
    print("    Starting NORMAL simulation...")
    result = make_request(
        f"{BASE_URL}/api/machines/1/simulate/start?scenario=NORMAL&speed=1",
        method="POST"
    )

    if not (result["success"] and result["status"] == 200):
        print(f"    Start failed: {result}")
        RESULTS["simulation"] = "FAIL"
        return False

    print("    Waiting for telemetry to accumulate...")
    time.sleep(5)

    # Get prediction to verify it's working
    print("    Checking prediction during simulation...")
    result = make_request(f"{BASE_URL}/api/machines/1/prediction")

    if result["success"] and result["status"] == 200:
        print(f"    Prediction during sim: {result['data'].get('predicted_status', 'N/A')}")

    # Pause simulation
    print("    Pausing simulation...")
    result = make_request(f"{BASE_URL}/api/machines/1/simulate/pause", method="POST")

    if result["success"] and result["status"] == 200:
        RESULTS["simulation"] = "PASS"
        print("    PASS")
        return True

    RESULTS["simulation"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_alerts():
    """Test GET /api/alerts"""
    print("\n[7] Testing GET /api/alerts...")
    result = make_request(f"{BASE_URL}/api/alerts")

    if result["success"] and result["status"] == 200:
        alerts = result["data"]
        print(f"    Active alerts: {len(alerts)}")
        RESULTS["alerts"] = "PASS"
        print("    PASS")
        return True

    RESULTS["alerts"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_maintenance():
    """Test GET /api/maintenance"""
    print("\n[8] Testing GET /api/maintenance...")
    result = make_request(f"{BASE_URL}/api/maintenance")

    if result["success"] and result["status"] == 200:
        records = result["data"]
        print(f"    Maintenance records: {len(records)}")
        RESULTS["maintenance"] = "PASS"
        print("    PASS")
        return True

    RESULTS["maintenance"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_ml_status():
    """Test GET /api/ml/status"""
    print("\n[9] Testing GET /api/ml/status...")
    result = make_request(f"{BASE_URL}/api/ml/status")

    if result["success"] and result["status"] == 200:
        ml = result["data"]
        print(f"    Model loaded: {ml.get('model_loaded', False)}")
        print(f"    Model version: {ml.get('model_version', 'N/A')}")
        print(f"    Features: {len(ml.get('features', []))}")
        RESULTS["ml_status"] = "PASS"
        print("    PASS")
        return True

    RESULTS["ml_status"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_ml_evaluate():
    """Test GET /api/ml/evaluate"""
    print("\n[10] Testing GET /api/ml/evaluate...")
    result = make_request(f"{BASE_URL}/api/ml/evaluate")

    if result["success"] and result["status"] == 200:
        eval_data = result["data"]
        print(f"    Success: {eval_data.get('success', False)}")
        RESULTS["ml_evaluation"] = "PASS"
        print("    PASS")
        return True

    RESULTS["ml_evaluation"] = "FAIL"
    print(f"    FAIL: {result}")
    return False

def test_websocket():
    """Test WebSocket functionality"""
    print("\n[11] Testing WebSocket...")
    try:
        import websocket

        ws = websocket.WebSocket()
        ws.connect(f"ws://127.0.0.1:9000/api/ws")

        # Receive welcome message
        msg = ws.recv()
        data = json.loads(msg)

        if data.get("type") == "welcome":
            print(f"    WebSocket connected")
            print(f"    Message type: {data.get('type')}")
            print(f"    Machines: {len(data.get('machines', []))}")
            ws.close()
            RESULTS["websocket"] = "PASS"
            print("    PASS")
            return True
    except ImportError:
        print("    WebSocket library not available - skipping WS test")
        RESULTS["websocket"] = "SKIP (no websocket-client)"
        return True
    except Exception as e:
        print(f"    WebSocket error: {e}")

    RESULTS["websocket"] = "FAIL"
    print("    FAIL")
    return False

def test_telemetry_stability():
    """Test that telemetry pipeline runs without errors"""
    print("\n[12] Testing telemetry stability (10 seconds)...")

    # Get initial readings count
    result = make_request(f"{BASE_URL}/api/machines/1/readings")
    if result["success"]:
        initial_count = result["data"].get("count", 0)
        print(f"    Initial readings: {initial_count}")
    else:
        initial_count = 0

    # Wait and let pipeline accumulate more readings
    print("    Waiting 10 seconds...")
    time.sleep(10)

    # Get new readings count
    result = make_request(f"{BASE_URL}/api/machines/1/readings")
    if result["success"]:
        final_count = result["data"].get("count", 0)
        new_readings = final_count - initial_count
        print(f"    New readings added: {new_readings}")

        if new_readings > 0:
            RESULTS["telemetry_stability"] = "PASS"
            print("    PASS - Telemetry pipeline running")
            return True

    RESULTS["telemetry_stability"] = "FAIL"
    print("    FAIL - No new readings added")
    return False

def run_tests():
    """Run all integration tests"""
    print("=" * 60)
    print("BACKEND INTEGRATION TEST")
    print("=" * 60)

    # Run tests in order
    test_machines()
    test_machine_detail()
    test_readings()
    test_prediction()
    test_history()
    test_simulation()
    test_alerts()
    test_maintenance()
    test_ml_status()
    test_ml_evaluate()
    test_websocket()
    test_telemetry_stability()

    # Print summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)

    for test_name, result in RESULTS.items():
        status = "[PASS]" if result == "PASS" else "[FAIL]" if result == "FAIL" else "[SKIP]"
        print(f"{status} {test_name}: {result}")

    # Count passes
    passed = sum(1 for v in RESULTS.values() if v == "PASS")
    total = len(RESULTS)

    print(f"\nPassed: {passed}/{total}")

    if passed == total:
        print("\n*** ALL TESTS PASSED ***")
    else:
        print(f"\n*** {total - passed} TEST(S) FAILED ***")

    return passed == total

if __name__ == "__main__":
    run_tests()