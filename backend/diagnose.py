"""Direct diagnostic of the exact code path used by main.py"""
import sys
import os

# Exact imports from main.py
from simulation.simulator import MachineSimulator
from database import db

print("=" * 60)
print("DIAGNOSTIC: Exact simulator code path")
print("=" * 60)

# Initialize database
db.init_db()
db.init_simulation_state()

# Create simulator - EXACT same way main.py does
simulator = MachineSimulator()

# Initialize machine - EXACT same way main.py does
machines = db.get_machines()
for m in machines:
    simulator.initialize_machine(m["id"], m["machine_type"])

print(f"\n1. Machines: {len(machines)}")
print(f"   Machine 1 type: {machines[0]['machine_type']}")

# Generate reading - EXACT same way main.py does
mid = machines[0]["id"]
mtype = machines[0]["machine_type"]
reading = simulator.generate_reading(mid, mtype)

print(f"\n2. Generated reading:")
print(f"   Type: {type(reading)}")
print(f"   Keys: {list(reading.keys())}")
print(f"   Full dict: {reading}")

# Check if 'time' key exists
print(f"\n3. Key check:")
print(f"   Has 'time': {'time' in reading}")
print(f"   Has 'timestamp': {'timestamp' in reading}")

# Try to access reading["time"] - this is what fails
print(f"\n4. Accessing reading['time']:")
try:
    time_val = reading["time"]
    print(f"   SUCCESS: {time_val}")
except KeyError as e:
    print(f"   FAILED: KeyError - {e}")

# Try database insert - this is what fails
print(f"\n5. Database insert:")
try:
    db.insert_sensor_reading(reading)
    print("   SUCCESS: Inserted")
except KeyError as e:
    print(f"   FAILED: KeyError - {e}")
    print(f"   Error on key: {e}")

# Print the simulator source file location
print(f"\n6. Simulator location:")
print(f"   {MachineSimulator.__module__}")

# Print simulator source to confirm
import inspect
source = inspect.getsourcefile(MachineSimulator)
print(f"   Source file: {source}")

print("\n" + "=" * 60)
print("END DIAGNOSTIC")
print("=" * 60)