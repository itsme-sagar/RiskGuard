import random
import math
from datetime import datetime

class MachineSimulator:
    """
    Realistic machine telemetry simulator for CNC machines and 3D printers.
    Generates sensor data with realistic baselines, noise, and degradation patterns.
    """

    def __init__(self):
        # Machine baselines (CNC vs 3D Printer)
        self.baselines = {
            "CNC Machine": {
                "temperature": 50.0,
                "vibration": 2.5,
                "motor_current": 8.0,
                "rpm": 2000.0,
                "workload": 50.0,
            },
            "3D Printer": {
                "temperature": 45.0,
                "vibration": 1.2,
                "motor_current": 4.5,
                "rpm": 1200.0,
                "workload": 40.0,
            }
        }

        # Standard deviations for normal operation
        self.noise_levels = {
            "temperature": 2.0,
            "vibration": 0.3,
            "motor_current": 0.5,
            "rpm": 50.0,
            "workload": 5.0,
        }

        # Per-machine degradation state
        self.degradation_state = {}

    def initialize_machine(self, machine_id, machine_type):
        """Initialize degradation state for a machine."""
        self.degradation_state[machine_id] = {
            "scenario": "NORMAL",
            "progress": 0.0,
            "speed": 1,
            "is_running": False,
            "operating_hours": 0.0,
            "workload_trend": 50.0,
        }

    def set_scenario(self, machine_id, scenario, speed=1, is_running=True):
        """Set simulation scenario for a machine."""
        if machine_id not in self.degradation_state:
            self.degradation_state[machine_id] = {
                "scenario": scenario,
                "progress": 0.0,
                "speed": speed,
                "is_running": is_running,
                "operating_hours": 0.0,
                "workload_trend": 50.0,
            }
        else:
            self.degradation_state[machine_id]["scenario"] = scenario
            self.degradation_state[machine_id]["speed"] = speed
            self.degradation_state[machine_id]["is_running"] = is_running
            if scenario == "NORMAL":
                self.degradation_state[machine_id]["progress"] = 0.0

    def reset_machine(self, machine_id):
        """Reset machine to normal state."""
        if machine_id in self.degradation_state:
            self.degradation_state[machine_id]["scenario"] = "NORMAL"
            self.degradation_state[machine_id]["progress"] = 0.0
            self.degradation_state[machine_id]["is_running"] = False

    def generate_reading(self, machine_id, machine_type):
        """
        Generate a single sensor reading for a machine.
        Returns a dict with all sensor parameters.
        """
        now = datetime.utcnow().isoformat() + "Z"

        if machine_id not in self.degradation_state:
            self.initialize_machine(machine_id, machine_type)

        state = self.degradation_state[machine_id]
        baseline = self.baselines[machine_type]

        # Advance degradation progress if running
        if state["is_running"]:
            progress_step = 0.02 * state["speed"]  # 2% per call at 1x speed
            state["progress"] = min(1.0, state["progress"] + progress_step)
        else:
            # Not running, don't advance
            state["progress"] = max(0.0, state["progress"] - 0.01)

        # Update operating hours
        if state["is_running"]:
            state["operating_hours"] += (1.0 / 3600.0) * state["speed"]  # 1 second per call

        # Generate workload trend (gradually increasing or normal)
        if state["scenario"] == "GRADUAL_DEGRADATION":
            # Workload tends to increase during degradation
            state["workload_trend"] += random.uniform(-2, 5)
            state["workload_trend"] = max(30, min(85, state["workload_trend"]))
        elif state["scenario"] == "NEAR_FAILURE":
            # High workload near failure
            state["workload_trend"] = random.uniform(75, 95)
        else:
            # Normal: stable workload with small noise
            state["workload_trend"] += random.uniform(-3, 3)
            state["workload_trend"] = max(30, min(70, state["workload_trend"]))

        workload = max(0, min(100, state["workload_trend"] + random.gauss(0, 2)))

        # Generate base sensor values
        temperature = baseline["temperature"] + random.gauss(0, self.noise_levels["temperature"])
        vibration = baseline["vibration"] + random.gauss(0, self.noise_levels["vibration"])
        motor_current = baseline["motor_current"] + random.gauss(0, self.noise_levels["motor_current"])
        rpm = baseline["rpm"] + random.gauss(0, self.noise_levels["rpm"])

        # Apply scenario effects
        progress = state["progress"]

        if state["scenario"] == "GRADUAL_DEGRADATION":
            # Gradual increase in all parameters
            temperature += (20.0 * progress) + (workload - 50) * 0.5
            vibration += (2.5 * progress) + (workload - 50) * 0.05
            motor_current += (4.0 * progress) + (workload - 50) * 0.1
            # RPM gradually becomes unstable
            rpm += random.gauss(0, self.noise_levels["rpm"] * (1 + 3 * progress))

        elif state["scenario"] == "NEAR_FAILURE":
            # Severe abnormal behavior
            temperature += (35.0 * progress) + (workload - 50) * 1.5
            vibration += (5.0 * progress) + (workload - 50) * 0.2
            motor_current += (7.0 * progress) + (workload - 50) * 0.3
            # RPM becomes very unstable
            rpm += random.gauss(0, self.noise_levels["rpm"] * (2 + 5 * progress))
            # Oscillations
            rpm += 500 * math.sin(datetime.now().timestamp() * 3)

        # Ensure physical limits
        temperature = max(20.0, min(120.0, temperature))
        vibration = max(0.1, vibration)
        motor_current = max(0.5, motor_current)
        rpm = max(0.0, rpm)

        return {
            "time": now,
            "machine_id": machine_id,
            "temperature": round(temperature, 2),
            "vibration": round(vibration, 2),
            "motor_current": round(motor_current, 2),
            "rpm": round(rpm, 1),
            "operating_hours": round(state["operating_hours"], 2),
            "workload": round(workload, 1),
        }

    def get_machine_state(self, machine_id):
        """Get current simulation state for a machine."""
        if machine_id not in self.degradation_state:
            return None
        return self.degradation_state[machine_id].copy()
