#!/usr/bin/env python3
"""
Test script to verify ML pipeline: training, evaluation, and inference.
"""
import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and report results."""
    print(f"\n{'='*60}")
    print(f"RUNNING: {description}")
    print(f"{'='*60}")
    print(f"Command: {' '.join(cmd)}")
    print()

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        if result.returncode != 0:
            print(f"ERROR: Command failed with return code {result.returncode}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("ERROR: Command timed out")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def main():
    """Run full ML pipeline tests."""
    print("\n" + "="*60)
    print("PREDICTIVE MAINTENANCE ML PIPELINE TEST")
    print("="*60)

    # Get the ml directory
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(ml_dir)

    # Change to ml directory
    os.chdir(ml_dir)

    steps = [
        ([sys.executable, "train.py"], "Train Random Forest Model"),
        ([sys.executable, "evaluate.py"], "Evaluate Model on Independent Data"),
    ]

    results = {}
    for cmd, desc in steps:
        success = run_command(cmd, desc)
        results[desc] = success
        if not success:
            print(f"\nFAILED: {desc}")
            break

    # Test inference through ml_engine
    print(f"\n{'='*60}")
    print("TESTING ML ENGINE INFERENCE")
    print(f"{'='*60}")

    try:
        from ml_engine import MLEngine

        engine = MLEngine()
        print(f"ML Engine initialized")
        print(f"  Model loaded: {engine.is_ml_available()}")
        print(f"  Model version: {engine.model_version}")
        print(f"  Features: {engine.feature_names}")

        # Test inference
        test_reading = {
            'temperature': 55.0,
            'vibration': 3.5,
            'motor_current': 9.0,
            'rpm': 2100.0,
            'operating_hours': 5000.0,
            'workload': 65.0
        }

        # Simulate building up buffer (need multiple readings for trend)
        for i in range(10):
            features = engine.calculate_features(1, test_reading)

        risk, status, importance = engine.run_inference(1, features, "CNC Machine")

        print(f"\nTest inference result:")
        print(f"  Risk score: {risk:.1f}%")
        print(f"  Status: {status}")
        print(f"  Contributing factors:")
        for factor, contrib in sorted(importance.items(), key=lambda x: x[1], reverse=True):
            print(f"    {factor}: {contrib*100:.1f}%")

        results["ML Engine Inference"] = True

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        results["ML Engine Inference"] = False

    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")

    for test, success in results.items():
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {test}")

    all_passed = all(results.values())
    print(f"\n{'='*60}")
    if all_passed:
        print("✓ ALL TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")
    print(f"{'='*60}")

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
