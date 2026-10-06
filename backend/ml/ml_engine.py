import numpy as np
import json
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

class MLEngine:
    """
    Machine Learning inference engine for predictive maintenance.
    Uses trained Random Forest classifier + Isolation Forest for anomaly detection.
    """

    def __init__(self):
        self.model_version = "v2.0.0-rf-trained"
        self.window_size = 60
        self.buffers = {}

        # Try to load trained model
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.class_names = ['NORMAL', 'WARNING', 'CRITICAL']
        self.model_loaded = False
        self.use_ml = False

        self._load_model()

    def _load_model(self):
        """Load trained model, scaler, and feature info."""
        try:
            import joblib
            models_dir = os.path.join(os.path.dirname(__file__), 'models')

            model_path = os.path.join(models_dir, 'failure_model.pkl')
            scaler_path = os.path.join(models_dir, 'scaler.pkl')
            feature_info_path = os.path.join(models_dir, 'feature_info.pkl')

            if all(os.path.exists(p) for p in [model_path, scaler_path, feature_info_path]):
                self.model = joblib.load(model_path)
                self.scaler = joblib.load(scaler_path)
                feature_info = joblib.load(feature_info_path)
                self.feature_names = feature_info['feature_names']
                self.class_names = feature_info['class_names']
                self.model_loaded = True
                self.use_ml = True
                print(f"[MLEngine] Loaded trained RandomForest model")
                print(f"[MLEngine] Features: {self.feature_names}")
            else:
                print("[MLEngine] No trained model found, using statistical fallback")
                self._setup_statistical_fallback()
        except Exception as e:
            print(f"[MLEngine] Error loading model: {e}")
            self._setup_statistical_fallback()

    def _setup_statistical_fallback(self):
        """Setup statistical fallback if no ML model available."""
        self.feature_names = [
            'temperature', 'vibration', 'motor_current', 'rpm',
            'workload', 'operating_hours', 'temperature_trend',
            'vibration_trend', 'motor_current_trend', 'rpm_std'
        ]
        self.use_ml = False

    def calculate_features(self, machine_id, current_reading):
        """
        Calculate time-series features from rolling sensor history.
        Features must match exactly what's used during training!
        """
        if machine_id not in self.buffers:
            self.buffers[machine_id] = {
                "temperature": [],
                "vibration": [],
                "motor_current": [],
                "rpm": [],
                "workload": [],
            }

        # Add current values to buffers
        buffer = self.buffers[machine_id]
        buffer["temperature"].append(current_reading["temperature"])
        buffer["vibration"].append(current_reading["vibration"])
        buffer["motor_current"].append(current_reading["motor_current"])
        buffer["rpm"].append(current_reading["rpm"])
        buffer["workload"].append(current_reading["workload"])

        # Maintain window size
        for key in buffer:
            if len(buffer[key]) > self.window_size:
                buffer[key] = buffer[key][-self.window_size:]

        features = {}

        for sensor, values in buffer.items():
            if len(values) < 5:
                features[f"{sensor}_mean"] = values[-1] if values else 0.0
                features[f"{sensor}_std"] = 0.0
                features[f"{sensor}_trend"] = 0.0
                features[f"{sensor}_rate_of_change"] = 0.0
                continue

            arr = np.array(values)
            mean = float(np.mean(arr))
            std = float(np.std(arr))

            # Trend: compare recent vs older values
            recent_mean = float(np.mean(arr[-10:]))
            older_mean = float(np.mean(arr[:max(1, len(arr)-10)]))
            trend = recent_mean - older_mean

            # Rate of change
            diffs = np.abs(np.diff(arr))
            rate_of_change = float(np.mean(diffs)) if len(diffs) > 0 else 0.0

            features[f"{sensor}_mean"] = mean
            features[f"{sensor}_std"] = std
            features[f"{sensor}_trend"] = trend
            features[f"{sensor}_rate_of_change"] = rate_of_change

        # Add operating hours directly from reading
        features['operating_hours'] = current_reading.get('operating_hours', 0.0)

        # Add rpm std
        if len(buffer['rpm']) >= 10:
            features['rpm_std'] = float(np.std(buffer['rpm'][-30:]))
        else:
            features['rpm_std'] = float(np.std(buffer['rpm'])) if len(buffer['rpm']) > 1 else 50.0

        return features

    def run_inference(self, machine_id, features, machine_type):
        """
        Run ML inference to predict failure probability and status.

        Returns:
            failure_probability: 0-100
            predicted_status: 'NORMAL', 'WARNING', or 'CRITICAL'
            feature_importance: dict of contributing factors
        """

        # Prepare feature vector in correct order
        feature_vector = self._prepare_feature_vector(features)

        if self.use_ml and self.model is not None:
            # Use trained ML model
            failure_probability, predicted_status, importance = self._ml_inference(feature_vector)
        else:
            # Use statistical fallback
            failure_probability, predicted_status, importance = self._statistical_inference(features)

        return failure_probability, predicted_status, importance

    def _prepare_feature_vector(self, features):
        """Prepare feature vector in the exact order used during training."""
        # Must match order in generate_data.py and train.py
        feature_order = [
            'temperature', 'vibration', 'motor_current', 'rpm',
            'workload', 'operating_hours', 'temperature_trend',
            'vibration_trend', 'motor_current_trend', 'rpm_std'
        ]

        vector = []
        for name in feature_order:
            if name in features:
                vector.append(features[name])
            elif f'{name}_mean' in features:
                vector.append(features[f'{name}_mean'])
            else:
                vector.append(0.0)

        return np.array(vector).reshape(1, -1)

    def _ml_inference(self, feature_vector):
        """Run actual ML model inference."""
        try:
            # Scale features
            X_scaled = self.scaler.transform(feature_vector)

            # Get prediction and probabilities
            prediction = self.model.predict(X_scaled)[0]
            probabilities = self.model.predict_proba(X_scaled)[0]

            # Map prediction to status
            class_idx = int(prediction)
            predicted_status = self.class_names[class_idx]

            # Convert probability to risk score (0-100)
            # Use weighted sum of probabilities for risk
            # CRITICAL gets highest weight, WARNING medium, NORMAL low
            weights = [0.1, 0.5, 0.9]  # NORMAL, WARNING, CRITICAL
            failure_probability = sum(p * w for p, w in zip(probabilities, weights)) * 100

            # Override with direct probability of critical class
            critical_prob = probabilities[2] if len(probabilities) > 2 else 0
            warning_prob = probabilities[1] if len(probabilities) > 1 else 0

            # Enhanced risk calculation
            base_risk = critical_prob * 100
            warning_contribution = warning_prob * 50

            # Factor in operating hours (older machines have slightly higher risk)
            operating_hours = feature_vector[0][5]  # operating_hours is 6th feature
            if operating_hours > 15000:
                base_risk *= 1.1

            failure_probability = min(95, base_risk + warning_contribution)

            # Apply thresholds
            if failure_probability >= 70:
                predicted_status = "CRITICAL"
            elif failure_probability >= 40:
                predicted_status = "WARNING"
            else:
                predicted_status = "NORMAL"

            # Get feature importance from model
            importance = self._get_feature_importance(feature_vector)

            return failure_probability, predicted_status, importance

        except Exception as e:
            print(f"[MLEngine] Error in ML inference: {e}")
            # Fallback to statistical
            return self._statistical_inference({})

    def _get_feature_importance(self, feature_vector):
        """Calculate feature importance based on model and current values."""
        if not self.use_ml or self.model is None:
            return {
                'temperature': 0.25,
                'vibration': 0.25,
                'motor_current': 0.25,
                'rpm': 0.25
            }

        try:
            # Get feature importances from model
            model_importance = self.model.feature_importances_
            feature_importance = {}

            for i, name in enumerate(self.feature_names):
                feature_importance[name] = float(model_importance[i])

            # Sort by importance
            sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)

            # Normalize and return top factors
            total = sum(v for _, v in sorted_importance[:4])
            result = {}
            for feat, imp in sorted_importance[:4]:
                result[feat] = imp / total

            return result

        except Exception as e:
            print(f"[MLEngine] Error getting feature importance: {e}")
            return {
                'temperature': 0.25,
                'vibration': 0.25,
                'motor_current': 0.25,
                'rpm_stability': 0.25
            }

    def _statistical_inference(self, features):
        """
        Statistical fallback inference when ML model is not available.
        This provides basic risk scoring based on thresholds.
        """
        temp = features.get('temperature_mean', 50)
        vib = features.get('vibration_mean', 2.5)
        current = features.get('motor_current_mean', 8)
        rpm = features.get('rpm_mean', 2000)
        workload = features.get('workload_mean', 50)

        temp_trend = features.get('temperature_trend', 0)
        vib_trend = features.get('vibration_trend', 0)
        rpm_std = features.get('rpm_std', 50)

        # Base risk
        failure_probability = 5.0
        factors = {}

        # Temperature analysis
        if temp > 80:
            failure_probability = max(failure_probability, 85)
            factors['overheating'] = 0.6
        elif temp > 70:
            failure_probability = max(failure_probability, 50)
            factors['temperature_elevated'] = 0.4

        # Vibration analysis
        if vib > 5:
            failure_probability = max(failure_probability, 80)
            factors['excessive_vibration'] = 0.55
        elif vib > 3.5:
            failure_probability = max(failure_probability, 45)
            factors['vibration_elevated'] = 0.35

        # Motor current
        if current > 12:
            failure_probability = max(failure_probability, 70)
            factors['high_motor_load'] = 0.45

        # Trends
        trend_count = sum([1 for t in [temp_trend, vib_trend] if t > 5])
        if trend_count >= 2:
            failure_probability = min(95, failure_probability * 1.2)

        # RPM instability
        if rpm_std > 200:
            failure_probability = max(failure_probability, 60)
            factors['rpm_unstable'] = 0.4

        # High workload
        if workload > 85:
            failure_probability *= 1.1

        # Determine status
        if failure_probability >= 70:
            predicted_status = "CRITICAL"
        elif failure_probability >= 40:
            predicted_status = "WARNING"
        else:
            predicted_status = "NORMAL"

        # Feature importance
        if not factors:
            factors = {
                'temperature': 0.25,
                'vibration': 0.25,
                'motor_current': 0.25,
                'workload': 0.25
            }
        else:
            total = sum(factors.values())
            factors = {k: v/total for k, v in factors.items()}

        return min(95, failure_probability), predicted_status, factors

    def clear_buffers(self, machine_id):
        """Clear historical buffers for a machine."""
        if machine_id in self.buffers:
            del self.buffers[machine_id]

    def is_ml_available(self):
        """Check if ML model is loaded and available."""
        return self.model_loaded and self.use_ml