# backend/app/email_service.py
"""
Shared email helpers for Khana Bachao.
All notification emails are sent in background threads so they never block the API.
"""
import os
import smtplib
import threading
import email.utils
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")


def _send_email(to: str, subject: str, plain: str, html: str):
    """Low-level send. Runs inside a background thread — never raises to caller."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Khana Bachao <{SENDER_EMAIL}>"
        msg["To"] = to
        msg["Message-ID"] = email.utils.make_msgid()
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to, msg.as_string())
        print(f"[email_service] Sent '{subject}' to {to}")
    except Exception as e:
        print(f"[email_service] Failed to send '{subject}' to {to}: {e}")


def _send_in_background(to: str, subject: str, plain: str, html: str):
    """Fire-and-forget email delivery in a daemon thread."""
    t = threading.Thread(target=_send_email, args=(to, subject, plain, html), daemon=True)
    t.start()


# ──────────────────────────────────────────
#  Notification: New listing → NGOs
# ──────────────────────────────────────────

def send_new_listing_notification(
    ngo_email: str,
    ngo_name: str,
    listing_id: int,
    food_items: list[str],
    location: str,
    available_until: str,
    provider_name: str,
):
    """Notify an NGO that a new food listing has been posted."""
    dishes = ", ".join(food_items) if food_items else "Various items"
    subject = f"🍛 New food available: {dishes}"

    plain = (
        f"Hi {ngo_name},\n\n"
        f"A new food listing has been posted on Khana Bachao!\n\n"
        f"Food: {dishes}\n"
        f"Location: {location}\n"
        f"Available until: {available_until}\n"
        f"Posted by: {provider_name}\n\n"
        f"Log in to claim it before someone else does.\n\n"
        f"— Khana Bachao"
    )

    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 520px;">
        <h2 style="color: #C05A2C;">New food available! 🍛</h2>
        <p>Hi {ngo_name},</p>
        <p>A new listing has just been posted on Khana Bachao:</p>
        <div style="background: #FFF7F0; border-left: 4px solid #C05A2C; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 6px;"><strong>🍱 Food:</strong> {dishes}</p>
          <p style="margin: 0 0 6px;"><strong>📍 Location:</strong> {location}</p>
          <p style="margin: 0 0 6px;"><strong>🕐 Available until:</strong> {available_until}</p>
          <p style="margin: 0;"><strong>👤 Posted by:</strong> {provider_name}</p>
        </div>
        <p>Log in to <strong>claim it</strong> before someone else does!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">
          You received this because you have email notifications enabled.
          You can turn them off from your dashboard settings.
        </p>
      </body>
    </html>
    """

    _send_in_background(ngo_email, subject, plain, html)


# ──────────────────────────────────────────
#  Notification: Listing claimed → FP
# ──────────────────────────────────────────

def send_claim_notification(
    fp_email: str,
    fp_name: str,
    listing_id: int,
    food_items: list[str],
    location: str,
    ngo_name: str,
):
    """Notify a Food Provider that their listing has been claimed by an NGO."""
    dishes = ", ".join(food_items) if food_items else "Your listing"
    subject = f"✅ Your listing has been claimed: {dishes}"

    plain = (
        f"Hi {fp_name},\n\n"
        f"Great news! An NGO has claimed your food listing.\n\n"
        f"Listing: {dishes}\n"
        f"Location: {location}\n"
        f"Claimed by: {ngo_name}\n\n"
        f"A chat has been opened so you can coordinate the pickup.\n"
        f"Log in to your dashboard to start the conversation.\n\n"
        f"— Khana Bachao"
    )

    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 520px;">
        <h2 style="color: #1D9E75;">Your listing has been claimed! ✅</h2>
        <p>Hi {fp_name},</p>
        <p>Great news — an NGO has claimed your food listing:</p>
        <div style="background: #E1F5EE; border-left: 4px solid #1D9E75; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0 0 6px;"><strong>🍱 Food:</strong> {dishes}</p>
          <p style="margin: 0 0 6px;"><strong>📍 Location:</strong> {location}</p>
          <p style="margin: 0;"><strong>🏢 Claimed by:</strong> {ngo_name}</p>
        </div>
        <p>A <strong>chat</strong> has been opened — log in to coordinate the pickup.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">
          You received this because you have email notifications enabled.
          You can turn them off from your dashboard settings.
        </p>
      </body>
    </html>
    """

    _send_in_background(fp_email, subject, plain, html)
