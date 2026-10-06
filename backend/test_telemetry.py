"""Quick test to verify telemetry pipeline works."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import db
from simulation.simulator import MachineSimulator
from ml.ml_engine import MLEngine

def test_pipeline():
    print("=" * 60)
    print("TELEMETRY PIPELINE TEST")
    print("=" * 60)

    # Initialize DB
    print("\n1. Initializing database...")
    db.init_db()
    db.init_simulation_state()
    print("   OK - Database initialized")

    # Create simulator
    print("\n2. Creating simulator...")
    simulator = MachineSimulator()
    simulator.initialize_machine(1, "CNC Machine")
    print("   OK - Simulator created")

    # Generate a reading
    print("\n3. Generating sensor reading...")
    reading = simulator.generate_reading(1, "CNC Machine")
    print(f"   Reading keys: {list(reading.keys())}")
    print(f"   Temperature: {reading['temperature']}")
    print(f"   Vibration: {reading['vibration']}")

    # Test DB insert
    print("\n4. Inserting reading into database...")
    db.insert_sensor_reading(reading)
    print("   OK - Reading inserted successfully")

    # Test ML inference
    print("\n5. Testing ML inference...")
    ml = MLEngine()
    print(f"   ML model loaded: {ml.is_ml_available()}")

    # Build up features
    for i in range(20):
        features = ml.calculate_features(1, reading)

    risk, status, importance = ml.run_inference(1, features, "CNC Machine")
    print(f"   Risk: {risk:.1f}%")
    print(f"   Status: {status}")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    test_pipeline()