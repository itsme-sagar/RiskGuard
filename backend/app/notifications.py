import base64
from datetime import datetime
import json
import os
from pathlib import Path
import re
import smtplib
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
import urllib.error
import urllib.parse
import urllib.request

BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "data" / "predmaint.db"
ENV_PATH = BACKEND_DIR / ".env"


def _load_env_file(force_reload: bool = False):
    """
    Dynamically loads or reloads variables from backend/.env.
    Enables instant configuration updates without needing server restarts.
    """
    if not ENV_PATH.exists():
        return
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'\"")
                if key:
                    if force_reload or key not in os.environ:
                        os.environ[key] = val
    except Exception as e:
        print(f"[Notifications] Error loading .env file: {e}")


# Initial environment load
_load_env_file(force_reload=True)

# In-memory deduplication tracker: machine_id -> {"level": level, "timestamp": float, "reason": reason}
_last_alert_dispatch: Dict[str, Dict[str, Any]] = {}
_dispatch_lock = threading.Lock()
COOLDOWN_SECONDS = 300  # 5 minutes cooldown for identical continuing alerts


def _get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_notification_tables(conn: sqlite3.Connection):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            phone_number TEXT DEFAULT '',
            email_address TEXT DEFAULT '',
            whatsapp_number TEXT DEFAULT '',
            sms_enabled INTEGER DEFAULT 1,
            email_enabled INTEGER DEFAULT 1,
            whatsapp_enabled INTEGER DEFAULT 1,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id INTEGER,
            machine_id TEXT NOT NULL,
            machine_type TEXT NOT NULL,
            channel TEXT NOT NULL,
            recipient TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    # Ensure default row exists
    cur = conn.execute("SELECT id FROM notification_settings WHERE id = 1")
    if not cur.fetchone():
        now_iso = datetime.utcnow().isoformat(timespec="seconds")
        default_phone = os.environ.get("ALERT_PHONE_NUMBER", "+15551234567")
        default_email = os.environ.get("ALERT_EMAIL", "operator@factory.com")
        default_wa = os.environ.get("ALERT_WHATSAPP_NUMBER", "+15551234567")
        conn.execute(
            """
            INSERT INTO notification_settings (
                id, phone_number, email_address, whatsapp_number,
                sms_enabled, email_enabled, whatsapp_enabled, updated_at
            ) VALUES (1, ?, ?, ?, 1, 1, 1, ?)
            """,
            (default_phone, default_email, default_wa, now_iso),
        )
    conn.commit()


def get_channel_provider_status() -> Dict[str, Dict[str, Any]]:
    """
    Inspects environment variables and reports configuration status for each channel.
    NEVER exposes passwords, auth tokens, or private secrets to the caller.
    """
    _load_env_file(force_reload=True)

    # 1. Email (SMTP)
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = os.environ.get("SMTP_PORT", "").strip() or "587"
    smtp_username = (
        os.environ.get("SMTP_USERNAME", "").strip()
        or os.environ.get("SMTP_USER", "").strip()
    )
    smtp_password = os.environ.get("SMTP_PASSWORD", "").strip()
    alert_email_from = (
        os.environ.get("ALERT_EMAIL_FROM", "").strip()
        or os.environ.get("SMTP_FROM", "").strip()
        or os.environ.get("SMTP_FROM_EMAIL", "").strip()
        or smtp_username
    )

    missing_email = []
    if not smtp_host:
        missing_email.append("SMTP_HOST")
    if not smtp_username:
        missing_email.append("SMTP_USERNAME")
    if not smtp_password:
        missing_email.append("SMTP_PASSWORD")

    email_ready = len(missing_email) == 0

    # 2. WhatsApp (Meta WhatsApp Cloud API or Twilio WhatsApp API)
    wa_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()

    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    twilio_wa_from = (
        os.environ.get("TWILIO_WHATSAPP_FROM", "").strip()
        or os.environ.get("TWILIO_WHATSAPP_NUMBER", "").strip()
    )

    if wa_token and wa_phone_id:
        wa_ready = True
        wa_provider = f"Meta WhatsApp Cloud API (Phone ID: {wa_phone_id})"
        wa_from = wa_phone_id
        wa_missing = []
        wa_msg = f"Configured & Active (Meta Cloud API: {wa_phone_id})"
    elif twilio_sid and twilio_token and twilio_wa_from:
        wa_ready = True
        wa_provider = f"Twilio WhatsApp ({twilio_wa_from})"
        wa_from = twilio_wa_from
        wa_missing = []
        wa_msg = f"Configured & Active (Twilio WhatsApp: {twilio_wa_from})"
    else:
        wa_ready = False
        wa_provider = "WhatsApp Business API"
        wa_from = ""
        wa_missing = [
            "WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID (Meta Cloud API) or TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN (Twilio)"
        ]
        wa_msg = (
            "WhatsApp not configured: Missing WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID "
            "or TWILIO_ACCOUNT_SID in backend/.env"
        )

    return {
        "email": {
            "configured": email_ready,
            "provider": f"SMTP ({smtp_host}:{smtp_port})" if email_ready else "SMTP Service",
            "from_address": alert_email_from if email_ready else "",
            "missing": missing_email,
            "message": (
                f"Configured & Active ({smtp_username} via {smtp_host}:{smtp_port})"
                if email_ready
                else f"Email not configured: Missing {', '.join(missing_email)} in backend/.env"
            ),
        },
        "whatsapp": {
            "configured": False,
            "disabled": True,
            "status": "DISABLED",
            "provider": "WhatsApp Business (Disabled)",
            "from_number": "",
            "missing": ["Disabled for demo"],
            "message": "WhatsApp channel disabled for this deployment (Email Only policy active).",
        },
        "sms": {
            "configured": False,
            "disabled": True,
            "status": "DISABLED",
            "provider": "SMS Service (Disabled)",
            "from_number": "",
            "missing": ["Disabled for demo"],
            "message": "SMS channel disabled for this deployment (Email Only policy active).",
        },
    }


def get_notification_settings() -> Dict[str, Any]:
    _load_env_file(force_reload=True)
    conn = _get_db()
    init_notification_tables(conn)
    row = conn.execute("SELECT * FROM notification_settings WHERE id = 1").fetchone()
    conn.close()

    channel_status = get_channel_provider_status()

    default_email = os.environ.get("ALERT_EMAIL", "").strip()
    default_wa = (
        os.environ.get("ALERT_WHATSAPP_NUMBER", "").strip()
        or os.environ.get("WHATSAPP_RECIPIENT_NUMBER", "").strip()
    )

    db_email = (row["email_address"] if row else "") or ""
    db_wa = (row["whatsapp_number"] if row else "") or ""

    final_email = db_email if db_email else default_email
    final_wa = db_wa if db_wa else default_wa

    if not row:
        return {
            "email_address": final_email,
            "whatsapp_number": final_wa,
            "email_enabled": True,
            "whatsapp_enabled": False,
            "whatsapp_disabled": True,
            "providers": channel_status,
        }

    return {
        "email_address": final_email,
        "whatsapp_number": final_wa,
        "email_enabled": bool(row["email_enabled"]),
        "whatsapp_enabled": False,
        "whatsapp_disabled": True,
        "updated_at": row["updated_at"] or "",
        "providers": channel_status,
    }


def save_notification_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    conn = _get_db()
    init_notification_tables(conn)
    now_iso = datetime.utcnow().isoformat(timespec="seconds")
    email = str(payload.get("email_address", "")).strip()
    whatsapp = str(payload.get("whatsapp_number", "")).strip()
    email_en = 1 if payload.get("email_enabled", True) else 0
    whatsapp_en = 1 if payload.get("whatsapp_enabled", True) else 0

    conn.execute(
        """
        UPDATE notification_settings
        SET email_address = ?, whatsapp_number = ?,
            email_enabled = ?, whatsapp_enabled = ?,
            updated_at = ?
        WHERE id = 1
        """,
        (email, whatsapp, email_en, whatsapp_en, now_iso),
    )
    conn.commit()
    conn.close()
    return get_notification_settings()


def get_notification_logs(limit: int = 100) -> List[Dict[str, Any]]:
    conn = _get_db()
    init_notification_tables(conn)
    rows = conn.execute(
        """
        SELECT * FROM notification_logs
        WHERE UPPER(channel) != 'SMS'
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def log_notification_event(
    alert_id: Optional[int],
    machine_id: str,
    machine_type: str,
    channel: str,
    recipient: str,
    status: str,
    message: str,
    detail: Optional[str] = None,
):
    try:
        conn = _get_db()
        now_iso = datetime.utcnow().isoformat(timespec="seconds")
        conn.execute(
            """
            INSERT INTO notification_logs (
                alert_id, machine_id, machine_type, channel, recipient,
                status, message, detail, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert_id,
                machine_id,
                machine_type,
                channel,
                recipient,
                status,
                message,
                detail or "",
                now_iso,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Notifications] Failed to log notification event: {e}")


def format_detected_datetime(raw_dt: Optional[str]) -> str:
    if not raw_dt:
        dt = datetime.now()
    else:
        try:
            clean = str(raw_dt).replace("Z", "").split(".")[0]
            dt = datetime.fromisoformat(clean)
        except Exception:
            dt = datetime.now()
    return dt.strftime("%d %b %Y, %I:%M:%S %p")


def format_alert_message(alert: Dict[str, Any]) -> str:
    """
    Formats the notification alert message matching the exact required specification:
    RiskGuard Alert

    Machine: CNC-001
    Type: CNC Milling Machine
    Condition: CRITICAL
    Failure Risk: 87%
    Reason: High vibration and temperature
    Detected: 03 Oct 2026, 10:42:18 AM
    Recommendation: Inspect spindle/bearing assembly immediately.
    """
    machine_id = alert.get("machine_id") or alert.get("serial_number") or "CNC-MILL-01"
    machine_type = alert.get("machine_type") or alert.get("machine_name") or "CNC Milling Machine"
    condition = str(alert.get("condition") or alert.get("level") or alert.get("status") or "WARNING").upper()
    risk_raw = alert.get("risk_percentage") if alert.get("risk_percentage") is not None else alert.get("current_risk", 0.0)
    try:
        risk_pct = float(risk_raw)
    except (ValueError, TypeError):
        risk_pct = 0.0
    reason = alert.get("reason") or alert.get("message") or "Operating parameters exceeded nominal safety limit."
    recommendation = alert.get("recommendation") or "Inspect spindle/bearing assembly immediately."
    raw_time = alert.get("created_at") or alert.get("timestamp") or alert.get("time")
    detected_str = format_detected_datetime(raw_time)

    contributors = alert.get("contributors") or alert.get("main_factors")
    if contributors:
        if isinstance(contributors, list):
            contrib_str = ", ".join(contributors)
        else:
            contrib_str = str(contributors)
    else:
        contrib_str = "Spindle Temp, Mechanical Vibration, Cutting Torque, Spindle Current, Operating Workload"

    return (
        f"RiskGuard Alert\n\n"
        f"Machine:\n{machine_id}\n\n"
        f"Machine Name:\n{machine_type}\n\n"
        f"Status:\n{condition}\n\n"
        f"Failure Risk:\n{risk_pct:.1f}%\n\n"
        f"Timestamp:\n{detected_str}\n\n"
        f"Main contributing parameters:\n{contrib_str}\n\n"
        f"Reason:\n{reason}\n\n"
        f"Recommended Action:\n{recommendation}"
    )


def format_whatsapp_message(alert: Dict[str, Any]) -> str:
    machine_id = alert.get("machine_id") or alert.get("serial_number") or "CNC-001"
    machine_type = alert.get("machine_type") or alert.get("machine_name") or "CNC Milling Machine"
    condition = str(alert.get("condition") or alert.get("level") or alert.get("status") or "WARNING").upper()
    risk_raw = alert.get("risk_percentage") if alert.get("risk_percentage") is not None else alert.get("current_risk", 0.0)
    try:
        risk_pct = float(risk_raw)
    except (ValueError, TypeError):
        risk_pct = 0.0
    reason = alert.get("reason") or alert.get("message") or "Operating parameters exceeded nominal safety limit."
    recommendation = alert.get("recommendation") or "Inspect spindle/bearing assembly immediately."
    raw_time = alert.get("created_at") or alert.get("timestamp") or alert.get("time")
    detected_str = format_detected_datetime(raw_time)

    return (
        f"*RiskGuard Alert*\n\n"
        f"*Machine:* {machine_id}\n"
        f"*Type:* {machine_type}\n"
        f"*Condition:* {condition}\n"
        f"*Failure Risk:* {risk_pct:.1f}%\n"
        f"*Reason:* {reason}\n"
        f"*Detected:* {detected_str}\n"
        f"*Recommendation:* {recommendation}"
    )


def send_email_message(to_email: str, subject: str, body: str) -> Tuple[bool, str]:
    """
    Sends an alert email via real SMTP.
    Validates presence of SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD.
    Never fakes delivery.
    """
    _load_env_file(force_reload=True)
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port_raw = os.environ.get("SMTP_PORT", "").strip() or "587"
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        smtp_port = 587
    smtp_user = (
        os.environ.get("SMTP_USERNAME", "").strip()
        or os.environ.get("SMTP_USER", "").strip()
    )
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    smtp_from = (
        os.environ.get("ALERT_EMAIL_FROM", "").strip()
        or os.environ.get("SMTP_FROM", "").strip()
        or os.environ.get("SMTP_FROM_EMAIL", "").strip()
        or smtp_user
    )

    missing = []
    if not smtp_host:
        missing.append("SMTP_HOST")
    if not smtp_user:
        missing.append("SMTP_USERNAME")
    if not smtp_pass:
        missing.append("SMTP_PASSWORD")

    if missing:
        return False, f"Email not configured: Missing {', '.join(missing)} in backend/.env"

    try:
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"RiskGuard Alerts <{smtp_from}>" if "<" not in smtp_from else smtp_from
        msg["To"] = to_email

        # Plain text
        part_text = MIMEText(body, "plain", "utf-8")
        msg.attach(part_text)

        # HTML formatted email
        html_lines = body.replace("\n", "<br/>")
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
          <div style="background: #1e293b; padding: 18px 24px; border-bottom: 2px solid #ef4444;">
            <h2 style="margin: 0; color: #f8fafc; font-size: 18px;">RiskGuard Industrial Alert</h2>
            <span style="font-size: 12px; color: #94a3b8;">Automated Predictive Maintenance Dispatch</span>
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px; font-family: monospace; white-space: pre-wrap; background: #151e2d; color: #e2e8f0;">
{body}
          </div>
          <div style="background: #1e293b; padding: 12px 24px; font-size: 11px; color: #64748b; text-align: center;">
            RiskGuard Predictive Maintenance System • Edge Intelligence
          </div>
        </div>
        """
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_html)

        use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12.0)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=12.0)
            if use_tls:
                server.starttls()

        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [to_email], msg.as_string())
        server.quit()
        return True, f"Email delivered to {to_email} via {smtp_host}"
    except smtplib.SMTPAuthenticationError as auth_err:
        err_msg = auth_err.smtp_error.decode("utf-8", errors="ignore") if isinstance(auth_err.smtp_error, bytes) else str(auth_err)
        return False, f"SMTP Authentication Error: {err_msg}"
    except smtplib.SMTPException as smtp_err:
        return False, f"SMTP Protocol Error: {str(smtp_err)}"
    except Exception as e:
        return False, f"Email Delivery Failed: {str(e)}"


def send_whatsapp_message(to_number: str, body: str) -> Tuple[bool, str]:
    """
    Sends a WhatsApp alert via Meta WhatsApp Cloud API or Twilio WhatsApp API.
    Validates presence of required credentials in backend/.env.
    Never fakes delivery.
    """
    _load_env_file(force_reload=True)
    wa_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()

    clean_to = to_number.strip()
    if not clean_to:
        return False, "Recipient WhatsApp number is empty"

    # Option A: Meta WhatsApp Cloud API
    if wa_token and wa_phone_id:
        clean_recipient = re.sub(r"[^\d]", "", clean_to)
        try:
            url = f"https://graph.facebook.com/v21.0/{wa_phone_id}/messages"
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_recipient,
                "type": "text",
                "text": {"preview_url": False, "body": body},
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {wa_token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                resp_body = json.loads(resp.read().decode("utf-8"))
                msg_id = resp_body.get("messages", [{}])[0].get("id", "OK")
                return True, f"WhatsApp message sent via Meta Cloud API (ID: {msg_id})"
        except urllib.error.HTTPError as he:
            try:
                err_json = json.loads(he.read().decode("utf-8"))
                err_msg = err_json.get("error", {}).get("message", f"HTTP {he.code}: {he.reason}")
            except Exception:
                err_msg = f"HTTP {he.code}: {he.reason}"
            return False, f"Meta WhatsApp API Error: {err_msg}"
        except Exception as e:
            return False, f"Meta WhatsApp Delivery Failed: {str(e)}"

    # Option B: Twilio WhatsApp API
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    twilio_wa_from = (
        os.environ.get("TWILIO_WHATSAPP_FROM", "").strip()
        or os.environ.get("TWILIO_WHATSAPP_NUMBER", "").strip()
    )

    if twilio_sid and twilio_token and twilio_wa_from:
        formatted_to = clean_to if clean_to.startswith("whatsapp:") else f"whatsapp:{clean_to}"
        from_wa = twilio_wa_from if twilio_wa_from.startswith("whatsapp:") else f"whatsapp:{twilio_wa_from}"
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            data = urllib.parse.urlencode({
                "From": from_wa,
                "To": formatted_to,
                "Body": body,
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data, method="POST")
            auth_header = base64.b64encode(f"{twilio_sid}:{twilio_token}".encode("utf-8")).decode("ascii")
            req.add_header("Authorization", f"Basic {auth_header}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")

            with urllib.request.urlopen(req, timeout=12.0) as resp:
                resp_body = json.loads(resp.read().decode("utf-8"))
                sid = resp_body.get("sid", "OK")
                return True, f"WhatsApp sent successfully to {clean_to} (SID: {sid})"
        except urllib.error.HTTPError as he:
            try:
                err_json = json.loads(he.read().decode("utf-8"))
                err_msg = err_json.get("message", f"HTTP {he.code}: {err_json.get('detail', str(he))}")
            except Exception:
                err_msg = f"HTTP {he.code}: {he.reason}"
            return False, f"Twilio WhatsApp Error: {err_msg}"
        except Exception as e:
            return False, f"Twilio WhatsApp Delivery Failed: {str(e)}"

    return False, "WhatsApp not configured: Missing WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID (Meta Cloud API) or TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN (Twilio) in backend/.env"


def test_individual_channel(
    channel: Optional[str] = None,
    recipient: Optional[str] = None,
    custom_alert: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Dedicated test function for EMAIL and WHATSAPP.
    Provides verified pre-flight testing before real machine alerts.
    """
    settings = get_notification_settings()
    c = str(channel or "").strip().upper()

    now_iso = datetime.utcnow().isoformat(timespec="seconds")
    sample_alert = custom_alert or {
        "id": 99999,
        "machine_id": "CNC-MILL-01",
        "machine_type": "CNC Milling Machine",
        "level": "CRITICAL",
        "condition": "CRITICAL",
        "risk_percentage": 87.0,
        "reason": "High vibration and temperature",
        "recommendation": "Inspect spindle/bearing assembly immediately.",
        "created_at": now_iso,
        "timestamp": now_iso,
        "contributors": ["Spindle Temp", "Mechanical Vibration", "Cutting Torque"],
    }
    body_email = format_alert_message(sample_alert)
    body_wa = format_whatsapp_message(sample_alert)
    machine_id = sample_alert.get("machine_id", "CNC-MILL-01")
    machine_type = sample_alert.get("machine_type", "CNC Milling Machine")

    target_recipient = (recipient or "").strip()

    if c == "EMAIL":
        if not target_recipient:
            target_recipient = settings.get("email_address", "").strip()
        if not target_recipient:
            status = "SKIPPED"
            detail = "Recipient email address not provided"
        else:
            subj = f"[RiskGuard] CRITICAL - {machine_id}"
            ok, detail = send_email_message(target_recipient, subj, body_email)
            if ok:
                status = "SENT"
            elif "not configured" in detail.lower():
                status = "NOT_CONFIGURED"
            else:
                status = "FAILED"

        log_notification_event(
            None,
            machine_id,
            machine_type,
            "EMAIL",
            target_recipient or "[Not Set]",
            status,
            body_email,
            detail,
        )
        return {
            "channel": "EMAIL",
            "recipient": target_recipient or "[Not Set]",
            "status": status,
            "detail": detail,
            "timestamp": now_iso,
            "message": body_email,
        }

    elif c in ("WHATSAPP", "WA"):
        return {
            "channel": "WHATSAPP",
            "recipient": target_recipient or settings.get("whatsapp_number", "[Not Set]"),
            "status": "DISABLED",
            "detail": "WhatsApp channel is disabled for this deployment (Email Only policy active).",
            "timestamp": now_iso,
            "message": "WhatsApp disabled",
        }

    elif c == "SMS":
        return {
            "channel": "SMS",
            "recipient": target_recipient or settings.get("phone_number", "[Not Set]"),
            "status": "DISABLED",
            "detail": "SMS channel is disabled for this deployment (Email Only policy active).",
            "timestamp": now_iso,
            "message": "SMS disabled",
        }

    else:
        # Test all active channels (Email only policy active)
        results = []
        # Email
        email_to = target_recipient if ("@" in target_recipient) else settings.get("email_address", "").strip()
        if email_to:
            subj = f"[RiskGuard] CRITICAL - {machine_id}"
            ok, detail = send_email_message(email_to, subj, body_email)
            status = "SENT" if ok else ("NOT_CONFIGURED" if "not configured" in detail.lower() else "FAILED")
            log_notification_event(None, machine_id, machine_type, "EMAIL", email_to, status, body_email, detail)
            results.append({"channel": "EMAIL", "recipient": email_to, "status": status, "detail": detail})
        else:
            results.append({"channel": "EMAIL", "recipient": "[Not Set]", "status": "SKIPPED", "detail": "Email address not configured"})

        # WhatsApp (Reported as disabled)
        results.append({
            "channel": "WHATSAPP",
            "recipient": settings.get("whatsapp_number", "[Disabled]"),
            "status": "DISABLED",
            "detail": "WhatsApp channel disabled for this deployment",
        })

        return {
            "channels": ["EMAIL"],
            "results": results,
            "timestamp": now_iso,
        }


def should_notify_alert(alert: Dict[str, Any], is_test: bool = False) -> Tuple[bool, str]:
    """
    External notification policy:

    - WARNING: no external notification.
    - CRITICAL: send one Email notification for the active CRITICAL event.
    - Continuing CRITICAL readings are suppressed.
    - Returning to NORMAL resets the machine state.
    - WhatsApp and SMS are disabled for the current workflow.

    Tests are still allowed to exercise the Email channel explicitly.
    """
    if is_test:
        return True, "Test trigger allowed"

    level = str(
        alert.get("level")
        or alert.get("condition")
        or alert.get("status")
        or "NORMAL"
    ).upper()

    # Only CRITICAL machine states trigger an external notification.
    if level != "CRITICAL":
        return False, f"Alert level {level} does not trigger external email notifications"

    machine_id = str(
        alert.get("machine_id")
        or alert.get("serial_number")
        or "UNKNOWN"
    )
    now_ts = time.time()
    reason = str(alert.get("reason") or alert.get("message") or "")

    with _dispatch_lock:
        last = _last_alert_dispatch.get(machine_id)

        if last is not None:
            last_level = str(last.get("level", "")).upper()

            # A continuing CRITICAL condition must not spam the recipient.
            if last_level == "CRITICAL":
                return (
                    False,
                    f"Suppressed duplicate CRITICAL alert for {machine_id}"
                )

        # Record this CRITICAL dispatch.
        _last_alert_dispatch[machine_id] = {
            "level": "CRITICAL",
            "timestamp": now_ts,
            "reason": reason,
        }

        return True, f"New CRITICAL alert for {machine_id}: dispatching Email"


def reset_machine_alert_state(machine_id: str):
    """Called when a machine returns to NORMAL, allowing a future CRITICAL alert."""
    mid_str = str(machine_id).strip()
    with _dispatch_lock:
        keys_to_remove = [
            k for k in list(_last_alert_dispatch.keys())
            if k == mid_str or mid_str in k or k in mid_str
        ]
        for k in keys_to_remove:
            del _last_alert_dispatch[k]


def dispatch_alert_notifications(
    alert: Dict[str, Any],
    is_test: bool = False
) -> List[Dict[str, Any]]:
    """
    Dispatch external notifications.

    Current production policy:
      CRITICAL -> Email only
      WARNING  -> no external notification
      WhatsApp -> disabled
      SMS      -> disabled

    The Alerts/Incident Feed is handled by the existing alert system separately.
    """
    should_send, reason_why = should_notify_alert(alert, is_test=is_test)
    if not should_send:
        return []

    settings = get_notification_settings()
    machine_id = (
        alert.get("machine_id")
        or alert.get("serial_number")
        or "CNC-MILL-01"
    )
    machine_type = (
        alert.get("machine_type")
        or alert.get("machine_name")
        or "CNC Machine"
    )
    alert_id = alert.get("id")
    cond = str(
        alert.get("level")
        or alert.get("condition")
        or alert.get("status")
        or "CRITICAL"
    ).upper()

    results: List[Dict[str, Any]] = []

    # ============================================================
    # EMAIL ONLY
    # ============================================================
    if settings.get("email_enabled", True):
        email = settings.get("email_address", "").strip()
        body_email = format_alert_message(alert)

        if email:
            subj = f"[RiskGuard] CRITICAL - {machine_id}"
            ok, detail = send_email_message(email, subj, body_email)

            status = (
                "SENT"
                if ok
                else (
                    "NOT_CONFIGURED"
                    if "not configured" in detail.lower()
                    else "FAILED"
                )
            )

            log_notification_event(
                alert_id,
                machine_id,
                machine_type,
                "EMAIL",
                email,
                status,
                body_email,
                detail,
            )

            results.append(
                {
                    "channel": "EMAIL",
                    "recipient": email,
                    "status": status,
                    "detail": detail,
                }
            )
        else:
            log_notification_event(
                alert_id,
                machine_id,
                machine_type,
                "EMAIL",
                "[Not Set]",
                "SKIPPED",
                body_email,
                "Recipient email address not configured in settings",
            )

            results.append(
                {
                    "channel": "EMAIL",
                    "recipient": "[Not Set]",
                    "status": "SKIPPED",
                    "detail": "Email address not set",
                }
            )

    # WhatsApp intentionally disabled.
    # SMS intentionally disabled.
    #
    # We do NOT call send_whatsapp_message() and do NOT create
    # WhatsApp/SMS notification records for this workflow.

    return results


def notify_alert_created(alert: Dict[str, Any]):
    """Background notification worker for machine state changes."""
    level = str(
        alert.get("level")
        or alert.get("condition")
        or alert.get("status")
        or ""
    ).upper()

    machine_id = str(alert.get("machine_id") or "")

    # NORMAL clears the deduplication state so a later CRITICAL
    # condition can generate a new email.
    if level == "NORMAL":
        reset_machine_alert_state(machine_id)
        return

    # WARNING is intentionally visible in the Alerts/Incident Feed,
    # but does not send an external notification.
    if level != "CRITICAL":
        return

    thread = threading.Thread(
        target=dispatch_alert_notifications,
        args=(alert, False),
        daemon=True,
    )
    thread.start()