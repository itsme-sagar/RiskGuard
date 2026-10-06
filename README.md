<div align="center">

# 🛡️ RiskGuard

### Catching the breakdown before it happens.

**Intelligent Predictive Maintenance & Machine Failure Detection System**

Monitor machine health, detect degradation, predict failure risk, alert technicians, and connect incidents with maintenance actions — all from one platform.

<br/>

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

<br/>

**Designed & Developed by Sagar Dhakal & Co.**

</div>

---

## 📌 Overview

**RiskGuard** is a simulation-driven predictive maintenance platform developed for monitoring and analyzing the condition of industrial machines such as **CNC machines and 3D printers**.

The system continuously processes machine telemetry including:

- Temperature
- Vibration
- Motor current
- RPM
- Workload
- Operating hours

It combines **machine learning, feature/trend analysis, real-time monitoring, risk classification, intelligent alerts, and maintenance workflows** to identify machine degradation before it becomes a major failure.

The core idea is simple:

> **Detect the problem early. Explain the risk. Alert the right people. Take maintenance action before downtime happens.**

---

# 🎯 Problem Statement

### Intelligent Predictive Maintenance and Machine Failure Detection System

Industrial machines can gradually deteriorate before a visible or complete failure occurs.

Increasing temperature, abnormal vibration, unstable RPM, rising motor current, or sustained workload can indicate that a machine is moving away from normal operating conditions.

RiskGuard demonstrates how these signals can be monitored and analyzed continuously to:

1. Generate realistic machine-condition telemetry
2. Detect gradual degradation
3. Identify abnormal operating patterns
4. Predict machine failure risk using ML
5. Classify machine health as **NORMAL, WARNING, or CRITICAL**
6. Identify important contributing parameters
7. Generate actionable alerts
8. Connect incidents with maintenance operations
9. Generate incident and maintenance reports

---

# ✨ Key Features

## 📡 Real-Time Machine Monitoring

RiskGuard monitors machine telemetry in real time.

| Parameter | Purpose |
|---|---|
| 🌡️ Temperature | Detect overheating and thermal degradation |
| 📳 Vibration | Identify mechanical instability and abnormal vibration |
| ⚡ Motor Current | Observe increasing motor load |
| 🔄 RPM | Monitor spindle/speed behavior |
| 🏭 Workload | Understand operating load |
| ⏱️ Operating Hours | Track machine usage and aging |

---

## 🤖 Machine Learning Failure Prediction

The system uses a trained machine learning pipeline to estimate machine failure probability.

The prediction process uses current telemetry together with engineered features such as:

```text
temperature
vibration
motor_current
rpm
workload
operating_hours
temperature_trend
vibration_trend
motor_current_trend
rpm_std
```

The model produces:

- Failure probability
- Risk level
- Machine status
- Contributing parameters

---

## 🟢 NORMAL → 🟡 WARNING → 🔴 CRITICAL

RiskGuard translates machine condition into an easy-to-understand operational status.

| Status | Meaning | Typical Action |
|---|---|---|
| 🟢 **NORMAL** | Machine operating within expected conditions | Continue monitoring |
| 🟡 **WARNING** | Degradation or abnormal behavior detected | Inspect / schedule maintenance |
| 🔴 **CRITICAL** | High failure risk | Immediate attention required |

This makes the ML output useful not only for data analysis, but also for technicians and operators.

---

## 📈 Gradual Degradation Simulation

RiskGuard includes machine-condition simulation so the complete predictive maintenance lifecycle can be demonstrated without requiring physical industrial hardware.

A machine can progress through:

```text
NORMAL
   │
   ▼
Gradual Degradation
   │
   ▼
WARNING
   │
   ▼
Severe Degradation
   │
   ▼
CRITICAL
```

This allows judges, developers, and technicians to observe how sensor behavior and failure risk change over time.

---

## 🔍 Explainable Risk Analysis

RiskGuard goes beyond showing a single percentage.

It identifies the parameters that contribute to the predicted risk.

Example:

```text
Failure Risk: 87%

Main Contributing Parameters:
• Mechanical Vibration
• Spindle Temperature
• Operating Workload
• RPM Variation
```

This provides an explanation that can help technicians understand **what is driving the risk**.

---

## 🚨 Intelligent Incident & Alert Management

RiskGuard detects important machine state transitions:

```text
NORMAL → WARNING
WARNING → CRITICAL
CRITICAL → NORMAL
```

The system maintains active incidents separately from historical alert events.

Critical incidents can be acknowledged and connected directly to maintenance actions.

---

## 📧 Critical Email Notifications

RiskGuard supports real SMTP email notifications for critical machine conditions.

A critical alert contains information such as:

```text
RiskGuard Industrial Alert

Machine: 3DP-IND-02
Type: 3D Printer
Condition: CRITICAL
Failure Risk: XX%

Main contributing parameters:
Mechanical Vibration
Temperature
Operating Workload

Reason:
Machine condition has reached a critical risk level.

Recommended Action:
Inspect the machine immediately.
```

The system is designed to avoid repeatedly sending duplicate critical notifications for the same active incident.

> SMTP credentials are loaded through environment variables and are intentionally excluded from GitHub.

---

## 🏭 Fleet Health Overview

The dashboard provides a high-level view of the complete machine fleet.

It displays:

- Total machines
- Normal machines
- Warning machines
- Critical machines
- Average fleet risk
- Active incidents

Each machine can then be opened for more detailed monitoring.

---

## 🛠️ Maintenance Workflow

RiskGuard connects predictive alerts with maintenance operations.

From an active incident, technicians can create a maintenance record containing information such as:

- Machine
- Problem
- Maintenance type
- Corrective action
- Status
- Maintenance history

This creates a complete workflow:

```text
Prediction
    ↓
Incident
    ↓
Investigation
    ↓
Maintenance
    ↓
Maintenance Record
```

---

## 📋 Incident & Maintenance Reports

RiskGuard can generate structured incident reports containing:

- Machine information
- Failure analysis
- Contributing parameters
- Corrective maintenance
- Lockout/Tagout considerations
- Dispatch information
- Technician sign-off

Reports can be printed or saved as PDF using the browser.

---

# 🖥️ Application Screenshots

> Screenshots can be added to this section before the final portfolio release.

### RiskGuard Dashboard

_Add dashboard screenshot here._

### Fleet Health

_Add fleet overview screenshot here._

### Machine Monitoring

_Add machine telemetry screenshot here._

### Alerts & Incidents

_Add alerts screenshot here._

### Maintenance Workflow

_Add maintenance screenshot here._

### Incident Report

_Add report screenshot here._

---

# 🏗️ System Architecture

```text
                    ┌────────────────────────┐
                    │   Machine Simulator    │
                    │                        │
                    │   CNC / 3D Printer     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   Telemetry Pipeline    │
                    │                        │
                    │ Temp / Vibration /     │
                    │ Current / RPM / etc.   │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │  Feature Engineering   │
                    │                        │
                    │ Trends / Variance /    │
                    │ Operating Features     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   ML Prediction Engine  │
                    │                        │
                    │ Failure Probability     │
                    │ Risk Classification    │
                    └───────────┬────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │       RiskGuard Backend      │
                 │            FastAPI           │
                 └──────────────┬───────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       ┌────────────┐    ┌────────────┐    ┌────────────┐
       │ WebSocket  │    │   SQLite   │    │   Alert    │
       │ Real-Time  │    │  Database  │    │   Engine   │
       └─────┬──────┘    └────────────┘    └─────┬──────┘
             │                                    │
             │                                    ▼
             │                              ┌────────────┐
             │                              │   Email    │
             │                              │ Notification│
             │                              └────────────┘
             │
             ▼
       ┌──────────────────────────────────┐
       │        React Web Dashboard       │
       │                                  │
       │ Dashboard • Machines • Alerts    │
       │ Metrics • Maintenance • Reports  │
       └──────────────────────────────────┘
```

---

# 🧠 Machine Learning Pipeline

## Feature Engineering

RiskGuard prepares telemetry into model-ready features.

### Primary telemetry

```text
Temperature
Vibration
Motor Current
RPM
Workload
Operating Hours
```

### Derived features

```text
Temperature Trend
Vibration Trend
Motor Current Trend
RPM Standard Deviation
```

### Prediction flow

```text
Raw Telemetry
      ↓
Feature Extraction
      ↓
Trend Analysis
      ↓
Feature Vector
      ↓
Machine Learning Model
      ↓
Failure Probability
      ↓
Risk Classification
      ↓
Contributing Factors
```

---

# 🧪 Training & Evaluation

The repository contains scripts for the machine-learning workflow:

```text
backend/ml/
├── generate_data.py
├── train.py
├── evaluate.py
├── ml_engine.py
└── test_pipeline.py
```

The project also contains training data used by the predictive maintenance pipeline.

The model can be retrained using the included training workflow rather than requiring model artifacts to be committed to the public repository.

---

# 🧰 Technology Stack

## Backend

| Technology | Purpose |
|---|---|
| **Python** | Core backend and ML language |
| **FastAPI** | Backend API framework |
| **Uvicorn** | ASGI server |
| **WebSockets** | Real-time machine/alert updates |
| **SQLite** | Local application data storage |
| **Pydantic** | Data validation |

## Machine Learning

| Technology | Purpose |
|---|---|
| **Scikit-learn** | Machine learning model |
| **NumPy** | Numerical processing |
| **Pandas** | Data processing |
| **Matplotlib** | ML evaluation visualization |

## Frontend

| Technology | Purpose |
|---|---|
| **React** | User interface |
| **JavaScript** | Application logic |
| **TypeScript** | Type definitions |
| **Vite** | Frontend build and development |
| **CSS / Tailwind CSS** | Interface styling |
| **Recharts / visualization components** | Data visualization |
| **Axios** | API communication |

## Notifications

- SMTP
- Email alerts

## Development

- Git
- GitHub
- VS Code
- Windows

---

# 📁 Project Structure

```text
RiskGuard/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── notifications.py
│   │   ├── schemas.py
│   │   ├── simulator.py
│   │   └── ml/
│   │       └── predictor.py
│   │
│   ├── database/
│   │   ├── db.py
│   │   └── schema.sql
│   │
│   ├── ml/
│   │   ├── evaluate.py
│   │   ├── generate_data.py
│   │   ├── ml_engine.py
│   │   ├── test_pipeline.py
│   │   └── train.py
│   │
│   ├── simulation/
│   │   └── simulator.py
│   │
│   ├── data/
│   │   └── training_data.csv
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── data/
│   └── ai4i2020.csv
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── services/
│       └── types/
│
├── .gitignore
├── README.md
└── start_servers.bat
```

---

# ⚙️ Getting Started

## Prerequisites

Install:

- Python 3.12+ / compatible Python version
- Node.js
- npm
- Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/itsme-sagar/RiskGuard.git
cd RiskGuard
```

---

## 2. Backend Setup

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

## 3. Environment Configuration

Create:

```text
backend/.env
```

Use:

```text
backend/.env.example
```

as the configuration template.

Configure notification settings only if email alerts are required.

> ⚠️ **Never commit `backend/.env` or any credentials to GitHub.**

---

## 4. Start the Backend

From the `backend` directory:

```bash
uvicorn main:app --reload --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

---

## 5. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## 🪟 Windows Quick Start

The repository also includes:

```text
start_servers.bat
```

which can be used as a convenient Windows startup option.

---

# 🎬 Recommended Demonstration Flow

RiskGuard can be demonstrated using the following sequence.

### Step 1 — Open the Dashboard

Show:

- Fleet health
- Machine count
- Current statuses
- Average failure risk
- Active incidents

### Step 2 — Select a Machine

Show live:

- Temperature
- Vibration
- Motor current
- RPM
- Workload
- Operating hours

### Step 3 — Simulate Degradation

Increase the machine's degradation level and observe:

```text
Sensor Changes
      ↓
Trend Changes
      ↓
Risk Increases
      ↓
NORMAL → WARNING
```

### Step 4 — Explain the Risk

Show the contributing parameters identified by the prediction pipeline.

### Step 5 — Trigger Critical Condition

Demonstrate:

```text
WARNING → CRITICAL
```

### Step 6 — Show Alert

Open the Alerts section and show the active incident.

### Step 7 — Demonstrate Email Notification

Show the critical email containing:

- Machine
- Type
- Status
- Risk
- Timestamp
- Contributors
- Reason
- Recommended action

### Step 8 — Create Maintenance Record

Create a maintenance record directly from the incident.

### Step 9 — Generate Report

Generate the incident/maintenance report.

Complete workflow:

```text
DETECT
  ↓
PREDICT
  ↓
EXPLAIN
  ↓
ALERT
  ↓
MAINTAIN
  ↓
REPORT
```

---

# 🔐 Security & Repository Hygiene

The public repository intentionally excludes runtime and sensitive files.

Ignored examples include:

```text
.env
.venv/
node_modules/
frontend/dist/
*.db
*.sqlite
*.sqlite3
*.pkl
*.joblib
```

Never commit:

- SMTP passwords
- API keys
- Access tokens
- Personal credentials
- Production databases
- Private configuration files

Environment configuration should be supplied locally through `backend/.env`.

---

# 📌 Current Project Scope

RiskGuard is currently a **simulation-driven predictive maintenance platform**.

The current system demonstrates the predictive maintenance workflow using simulated machine telemetry rather than direct physical sensor or PLC integration.

It is suitable for:

- 🎓 Academic demonstrations
- 🏆 Hackathons
- 🔬 Predictive maintenance research
- 🏭 Industrial IoT prototypes
- 🤖 Machine learning demonstrations
- 🚀 Future real-machine integration

---

# 🔮 Future Improvements

Possible next-stage improvements include:

- [ ] Real IoT sensor integration
- [ ] ESP32 / Raspberry Pi telemetry
- [ ] MQTT communication
- [ ] Industrial PLC integration
- [ ] Cloud deployment
- [ ] Multi-site machine management
- [ ] Advanced time-series models
- [ ] Remaining Useful Life (RUL) prediction
- [ ] Mobile technician application
- [ ] Role-based authentication
- [ ] Advanced maintenance scheduling
- [ ] Historical fleet analytics
- [ ] Expanded notification channels

---

# 🏆 Project Goal

RiskGuard is built around one practical objective:

> **Catch the breakdown before it happens.**

Instead of waiting for a machine to fail, RiskGuard aims to detect degradation early, estimate failure risk, explain the factors behind that risk, notify the responsible people, and connect the incident to preventive maintenance.

---

# 📊 Project Status

### Current Capabilities

- ✅ CNC machine monitoring
- ✅ 3D printer monitoring
- ✅ Real-time machine simulation
- ✅ Machine telemetry processing
- ✅ Trend analysis
- ✅ Machine learning failure prediction
- ✅ Failure risk classification
- ✅ Explainable contributing parameters
- ✅ Real-time dashboard
- ✅ Fleet health overview
- ✅ Active incident management
- ✅ Critical email alerts
- ✅ Duplicate critical-alert protection
- ✅ Maintenance workflow
- ✅ Maintenance history
- ✅ Incident & maintenance reports
- ✅ GitHub repository

**Status:** Active Development / Hackathon Prototype

---

# 👨‍💻 Author

## Sagar Dhakal

**BE Computer Science & Engineering — 3rd Year**  
**KPR Institute of Engineering and Technology**  
Coimbatore, India

### Links

- GitHub: https://github.com/itsme-sagar
- RiskGuard Repository: https://github.com/itsme-sagar/RiskGuard

---

## 🤝 Credits

**Designed & Developed by Sagar Dhakal & Co.**

Built as an engineering project focused on combining:

**Machine Learning + Industrial Monitoring + Real-Time Systems + Predictive Maintenance**

---

<div align="center">

## 🛡️ RiskGuard

### Catching the breakdown before it happens.

⭐ If you find the project interesting, consider giving the repository a star.

**Built with Python · FastAPI · Machine Learning · React · Vite**

</div>
