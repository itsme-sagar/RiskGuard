"""
Train Random Forest classifier on synthetic sensor data.
"""
import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

def load_or_generate_data():
    """Load training data or generate if it doesn't exist."""
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'training_data.csv')

    if os.path.exists(data_path):
        print(f"Loading existing training data from {data_path}")
        df = pd.read_csv(data_path)
    else:
        print("Generating new training data...")
        from ml.generate_data import generate_training_data
        df = generate_training_data(n_samples=5000, random_state=42)

        # Save generated data for reproducibility and evaluation
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        df.to_csv(data_path, index=False)
        print(f"Saved training data to: {data_path}")

    return df

def prepare_features(df):
    """
    Prepare features for training.

    Feature engineering should match exactly what's used in live inference.
    """
    features = [
        'temperature',
        'vibration',
        'motor_current',
        'rpm',
        'workload',
        'operating_hours',
        'temperature_trend',
        'vibration_trend',
        'motor_current_trend',
        'rpm_std'
    ]

    X = df[features].values
    y = df['label'].values

    return X, y, features

def train_model():
    """Train Random Forest model and evaluate performance."""
    print("=" * 60)
    print("Training Predictive Maintenance Model")
    print("=" * 60)

    # Load or generate data
    df = load_or_generate_data()

    # Prepare features
    X, y, feature_names = prepare_features(df)

    print(f"\nTraining samples: {len(X)}")
    print(f"Features: {feature_names}")

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\nTrain size: {len(X_train)} samples")
    print(f"Test size: {len(X_test)} samples")

    # Standardize features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train Random Forest
    print("\nTraining Random Forest model...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        class_weight='balanced'  # Handle class imbalance
    )

    model.fit(X_train_scaled, y_train)

    # Make predictions
    y_pred = model.predict(X_test_scaled)
    y_pred_proba = model.predict_proba(X_test_scaled)

    # Evaluate model
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nModel Evaluation:")
    print(f"  Accuracy: {accuracy:.3f}")

    # Classification report
    print("\nClassification Report:")
    class_names = ['NORMAL', 'WARNING', 'CRITICAL']
    report = classification_report(y_test, y_pred, target_names=class_names, digits=3)
    print(report)

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print("\nConfusion Matrix:")
    print("        Predicted")
    print("        N W C")
    print("True N", cm[0])
    print("      W", cm[1])
    print("      C", cm[2])

    # Feature importance
    importance = model.feature_importances_
    feature_importance = sorted(zip(feature_names, importance), key=lambda x: x[1], reverse=True)

    print("\nFeature Importance:")
    for feat, imp in feature_importance:
        print(f"  {feat:20s}: {imp:.4f}")

    # Save model and scaler
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)

    model_path = os.path.join(models_dir, 'failure_model.pkl')
    scaler_path = os.path.join(models_dir, 'scaler.pkl')

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    print(f"\nModel saved to: {model_path}")
    print(f"Scaler saved to: {scaler_path}")

    # Also save feature names for reference
    feature_info = {
        'feature_names': feature_names,
        'class_names': class_names
    }
    joblib.dump(feature_info, os.path.join(models_dir, 'feature_info.pkl'))

    # Test inference on sample data
    print("\nTesting inference on sample data...")
    sample_data = {
        'temperature': 55.0,
        'vibration': 3.5,
        'motor_current': 9.0,
        'rpm': 2100.0,
        'workload': 65.0,
        'operating_hours': 5000.0,
        'temperature_trend': 0.5,
        'vibration_trend': 0.3,
        'motor_current_trend': 0.4,
        'rpm_std': 75.0
    }

    sample_df = pd.DataFrame([sample_data])
    sample_X = sample_df[feature_names].values
    sample_X_scaled = scaler.transform(sample_X)

    prediction = model.predict(sample_X_scaled)[0]
    proba = model.predict_proba(sample_X_scaled)[0]
    print(f"\nSample prediction:")
    print(f"  Raw features: {sample_data}")
    print(f"  Predicted class: {class_names[prediction]}")
    print(f"  Class probabilities:")
    for i, (cls, prob) in enumerate(zip(class_names, proba)):
        print(f"    {cls}: {prob:.3f}")

    return model, scaler, feature_names, class_names

def main():
    """Main training function."""
    try:
        train_model()
        print("\n" + "=" * 60)
        print("Training completed successfully!")
        print("=" * 60)
    except Exception as e:
        print(f"\nError during training: {e}")
        raise

if __name__ == "__main__":
    main()