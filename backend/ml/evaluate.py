"""
Evaluate trained model on independent test data.
Uses different random state to avoid data leakage from training.
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

def generate_evaluation_data(n_samples=2000, random_state=123):
    """
    Generate independent evaluation data with different random state.
    This ensures no data leakage from training.
    """
    # Import the generation function
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from ml.generate_data import generate_training_data

    np.random.seed(random_state)
    df = generate_training_data(n_samples=n_samples, random_state=random_state)
    return df

def evaluate_model():
    """Load and evaluate the trained model."""
    print("=" * 60)
    print("Model Evaluation")
    print("=" * 60)

    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    model_path = os.path.join(models_dir, 'failure_model.pkl')
    scaler_path = os.path.join(models_dir, 'scaler.pkl')
    feature_info_path = os.path.join(models_dir, 'feature_info.pkl')

    # Check if model exists
    if not os.path.exists(model_path):
        print("Error: No trained model found. Run train.py first.")
        print("  cd backend/ml && python train.py")
        return None

    print("Loading trained model...")
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    feature_info = joblib.load(feature_info_path)

    feature_names = feature_info['feature_names']
    class_names = feature_info['class_names']

    print(f"Model loaded: {model_path}")
    print(f"Features: {feature_names}")

    # Generate independent evaluation data (different random seed than training)
    print("\nGenerating independent evaluation data (random_state=123)...")
    df = generate_evaluation_data(n_samples=2000, random_state=123)

    print(f"Evaluation dataset size: {len(df)} samples")
    print(f"Class distribution:")
    for label, name in enumerate(class_names):
        count = (df['label'] == label).sum()
        print(f"  {name} ({label}): {count} ({count/len(df)*100:.1f}%)")

    # Prepare features
    X = df[feature_names].values
    y = df['label'].values

    # Scale features
    X_scaled = scaler.transform(X)

    # Make predictions
    y_pred = model.predict(X_scaled)
    y_pred_proba = model.predict_proba(X_scaled)

    # Calculate metrics
    accuracy = accuracy_score(y, y_pred)

    print("\n" + "=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)
    print(f"\nAccuracy: {accuracy:.3f} ({accuracy*100:.1f}%)")

    print("\nClassification Report:")
    print(classification_report(y, y_pred, target_names=class_names, digits=3))

    print("Confusion Matrix:")
    print("              Predicted")
    print("             N    W    C")
    cm = confusion_matrix(y, y_pred)
    print(f"True N      {cm[0][0]:3d}  {cm[0][1]:3d}  {cm[0][2]:3d}")
    print(f"      W     {cm[1][0]:3d}  {cm[1][1]:3d}  {cm[1][2]:3d}")
    print(f"      C     {cm[2][0]:3d}  {cm[2][1]:3d}  {cm[2][2]:3d}")

    # Feature importance from model
    print("\nFeature Importance (from Random Forest):")
    importance = model.feature_importances_
    feature_importance = sorted(zip(feature_names, importance), key=lambda x: x[1], reverse=True)
    for feat, imp in feature_importance:
        bar = "#" * int(imp * 50)
        print(f"  {feat:20s}: {imp:.4f} {bar}")

    # Test specific cases
    print("\n" + "=" * 60)
    print("TEST CASES")
    print("=" * 60)

    test_cases = [
        {
            'name': 'Normal Operation',
            'features': {
                'temperature': 52.0, 'vibration': 2.3, 'motor_current': 7.8,
                'rpm': 2050.0, 'workload': 45.0, 'operating_hours': 2500.0,
                'temperature_trend': 0.1, 'vibration_trend': 0.05,
                'motor_current_trend': 0.08, 'rpm_std': 45.0
            }
        },
        {
            'name': 'Warning - Degradation',
            'features': {
                'temperature': 68.0, 'vibration': 4.2, 'motor_current': 10.5,
                'rpm': 2150.0, 'workload': 75.0, 'operating_hours': 12000.0,
                'temperature_trend': 12.0, 'vibration_trend': 1.8,
                'motor_current_trend': 2.5, 'rpm_std': 120.0
            }
        },
        {
            'name': 'Critical - Near Failure',
            'features': {
                'temperature': 85.0, 'vibration': 6.8, 'motor_current': 14.2,
                'rpm': 2300.0, 'workload': 90.0, 'operating_hours': 18000.0,
                'temperature_trend': 18.0, 'vibration_trend': 3.2,
                'motor_current_trend': 4.8, 'rpm_std': 280.0
            }
        }
    ]

    for test in test_cases:
        print(f"\n{test['name']}:")
        df_test = pd.DataFrame([test['features']])
        X_test = df_test[feature_names].values
        X_test_scaled = scaler.transform(X_test)

        prediction = model.predict(X_test_scaled)[0]
        probabilities = model.predict_proba(X_test_scaled)[0]

        print(f"  Prediction: {class_names[prediction]}")
        print(f"  Probabilities: N={probabilities[0]:.3f}, W={probabilities[1]:.3f}, C={probabilities[2]:.3f}")

    return {
        'accuracy': accuracy,
        'confusion_matrix': cm.tolist(),
        'classification_report': classification_report(y, y_pred, target_names=class_names, output_dict=True)
    }

def main():
    """Run evaluation."""
    try:
        result = evaluate_model()
        if result:
            print("\n" + "=" * 60)
            print("Evaluation completed successfully!")
            print("=" * 60)
    except Exception as e:
        print(f"\nError during evaluation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()