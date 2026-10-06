"""
Generate synthetic training data for predictive maintenance ML model.
Creates realistic sensor readings with various failure conditions.
"""
import numpy as np
import pandas as pd
import os

def generate_training_data(n_samples=5000, random_state=42):
    """
    Generate synthetic machine sensor data with failure labels.

    Returns:
        DataFrame with sensor features and failure label
    """
    np.random.seed(random_state)

    data = []

    for i in range(n_samples):
        # Randomly choose a scenario
        scenario_pick = np.random.random()

        if scenario_pick < 0.6:
            # 60% NORMAL operation
            label = 0  # NORMAL
            temperature = np.random.normal(50, 3)
            vibration = np.random.normal(2.5, 0.3)
            motor_current = np.random.normal(8, 0.5)
            rpm = np.random.normal(2000, 50)
            workload = np.random.uniform(30, 70)
            operating_hours = np.random.uniform(0, 10000)

        elif scenario_pick < 0.85:
            # 25% GRADUAL DEGRADATION
            label = 1  # WARNING / DEGRADATION
            # Degradation has multiple levels
            severity = np.random.uniform(0.2, 0.8)
            temperature = 50 + severity * 25 + np.random.normal(0, 2)
            vibration = 2.5 + severity * 2.5 + np.random.normal(0, 0.3)
            motor_current = 8 + severity * 4 + np.random.normal(0, 0.5)
            rpm = 2000 + severity * 100 + np.random.normal(0, 50 * (1 + severity))
            workload = 50 + severity * 30 + np.random.uniform(-5, 5)
            operating_hours = np.random.uniform(5000, 15000)

        else:
            # 15% NEAR FAILURE
            label = 2  # CRITICAL
            severity = np.random.uniform(0.7, 1.0)
            # Multiple failure modes
            failure_type = np.random.choice(['overheating', 'vibration', 'motor', 'combined'])

            if failure_type == 'overheating':
                temperature = 70 + severity * 30 + np.random.normal(0, 3)
                vibration = 3 + severity * 2 + np.random.normal(0, 0.5)
                motor_current = 10 + severity * 3 + np.random.normal(0, 0.8)
                rpm = 2000 + np.random.normal(0, 150)
            elif failure_type == 'vibration':
                temperature = 55 + severity * 15 + np.random.normal(0, 2)
                vibration = 5 + severity * 3 + np.random.normal(0, 1)
                motor_current = 10 + severity * 2 + np.random.normal(0, 0.6)
                rpm = 2000 + np.random.normal(0, 200 * severity)
            elif failure_type == 'motor':
                temperature = 55 + severity * 10 + np.random.normal(0, 2)
                vibration = 3 + severity * 1.5 + np.random.normal(0, 0.4)
                motor_current = 12 + severity * 5 + np.random.normal(0, 1)
                rpm = 1800 - severity * 200 + np.random.normal(0, 100)
            else:  # combined
                temperature = 65 + severity * 25 + np.random.normal(0, 4)
                vibration = 4 + severity * 4 + np.random.normal(0, 1.2)
                motor_current = 11 + severity * 4 + np.random.normal(0, 1)
                rpm = 1900 + np.random.normal(0, 250 * severity)

            workload = 70 + severity * 25 + np.random.uniform(-5, 5)
            operating_hours = np.random.uniform(8000, 20000)

        # Add realistic noise and constraints
        temperature = np.clip(temperature, 20, 120)
        vibration = np.clip(vibration, 0.1, 15)
        motor_current = np.clip(motor_current, 0.5, 25)
        rpm = np.clip(rpm, 100, 5000)
        workload = np.clip(workload, 0, 100)

        # Generate trend features (simulate time-series)
        temp_trend = np.random.normal(0, 1) if label == 0 else np.random.uniform(2, 15)
        vib_trend = np.random.normal(0, 0.2) if label == 0 else np.random.uniform(0.5, 3)
        current_trend = np.random.normal(0, 0.3) if label == 0 else np.random.uniform(0.5, 4)

        data.append({
            'temperature': temperature,
            'vibration': vibration,
            'motor_current': motor_current,
            'rpm': rpm,
            'workload': workload,
            'operating_hours': operating_hours,
            'temperature_trend': temp_trend if label > 0 else temp_trend,
            'vibration_trend': vib_trend if label > 0 else vib_trend,
            'motor_current_trend': current_trend if label > 0 else current_trend,
            'rpm_std': abs(np.random.normal(50, 20) if label == 0 else 50 + severity * 150),
            'label': label
        })

    df = pd.DataFrame(data)
    return df

def main():
    """Generate and save training data."""
    print("=" * 60)
    print("Generating Synthetic Training Data")
    print("=" * 60)

    # Generate training data
    df = generate_training_data(n_samples=5000, random_state=42)

    print(f"\nGenerated {len(df)} samples")
    print(f"\nClass distribution:")
    print(f"  NORMAL (0): {(df['label'] == 0).sum()} ({(df['label'] == 0).mean()*100:.1f}%)")
    print(f"  WARNING (1): {(df['label'] == 1).sum()} ({(df['label'] == 1).mean()*100:.1f}%)")
    print(f"  CRITICAL (2): {(df['label'] == 2).sum()} ({(df['label'] == 2).mean()*100:.1f}%)")

    # Save to CSV
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'training_data.csv')
    df.to_csv(output_path, index=False)
    print(f"\nSaved training data to: {output_path}")

    # Show sample statistics
    print("\nFeature statistics:")
    for col in ['temperature', 'vibration', 'motor_current', 'rpm', 'workload']:
        print(f"  {col}: mean={df[col].mean():.2f}, std={df[col].std():.2f}")

    return df

if __name__ == "__main__":
    main()