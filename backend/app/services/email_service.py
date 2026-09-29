import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from ..config import IS_SERVERLESS, settings

logger = logging.getLogger("financeai.email")


class EmailNotConfigured(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


def email_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    if not email_configured():
        if IS_SERVERLESS:
            # Never skip verification in production just because mail isn't set up
            raise EmailNotConfigured("Email delivery is not configured on the server")
        # Local development: print instead of sending so the flow is testable without credentials
        print(f"\n[email to {to}] {subject}\n{text}\n", flush=True)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
    message["To"] = to
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    try:
        context = ssl.create_default_context()
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=20) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(message)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.starttls(context=context)
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("Failed to send email to %s", to)
        raise EmailDeliveryError("Could not send the verification email") from exc


def send_otp_email(to: str, code: str, purpose: str, ttl_minutes: int) -> None:
    action = {
        "register": "finish creating your account",
        "login": "sign in",
        "change_email": "confirm this as your new FinanceAI email address",
        "reset_password": "reset your FinanceAI password",
        "change_password": "change your FinanceAI password",
    }.get(purpose, "continue")
    subject = f"{code} is your FinanceAI verification code"
    text = (
        f"Your FinanceAI verification code is {code}.\n\n"
        f"Enter it to {action}. It expires in {ttl_minutes} minutes.\n\n"
        "If you didn't request this, you can ignore this email. Someone may have typed your address by mistake, "
        "but they can't get in without this code."
    )
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 8px">FinanceAI</h2>
  <p style="margin:0 0 20px;color:#475569">Enter this code to {action}:</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center">{code}</div>
  <p style="margin:20px 0 0;color:#475569;font-size:14px">It expires in {ttl_minutes} minutes. If you didn't request this, you can safely ignore this email.</p>
</div>"""
    send_email(to, subject, text, html)


def send_email_changed_notice(old_email: str, new_email: str) -> None:
    send_email(
        old_email,
        "Your FinanceAI email address was changed",
        f"The email address on your FinanceAI account was changed from {old_email} to {new_email}.\n\n"
        "If you made this change, no action is needed. If you didn't, reply to this email or contact support right away "
        "and change your password.",
    )


def send_password_changed_notice(email: str) -> None:
    send_email(
        email,
        "Your FinanceAI password was changed",
        "The password for your FinanceAI account was just changed.\n\n"
        "If this was you, no action is needed. If it wasn't, use 'Forgot password' on the sign-in page right away.",
    )
