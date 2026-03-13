import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
from dotenv import load_dotenv

load_dotenv()

# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("EMAIL_PORT", "587"))
SMTP_USER = os.getenv("EMAIL_USER")
SMTP_PASS = os.getenv("EMAIL_PASS")

def send_invitation_email(to_email: str, workspace_name: str, invite_link: str):
    """Sends an invitation email."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"SMTP credentials not found. Mocking email to {to_email}")
        logger.info(f"Invite Link: {invite_link}")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = f"Invitation to join {workspace_name} on Campus Agent"

        body = f"""
        <html>
          <body>
            <h2>Join {workspace_name}!</h2>
            <p>You have been invited to collaborate on the <b>{workspace_name}</b> workspace.</p>
            <p>Click the link below to accept the invitation:</p>
            <a href="{invite_link}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Join Workspace
            </a>
            <p>Or copy this link: {invite_link}</p>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        text = msg.as_string()
        server.sendmail(SMTP_USER, to_email, text)
        server.quit()
        logger.info(f"Invitation sent to {to_email}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

def send_assignment_notification(to_email: str, student_name: str, assignment_title: str, deadline: str, subject_name: str, submission_link: str):
    """Sends an assignment notification email to a student."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"SMTP credentials not found. Mocking email to {to_email}")
        logger.info(f"Assignment: {assignment_title}, Deadline: {deadline}, Link: {submission_link}")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = f"New Assignment: {assignment_title} — {subject_name}"

        body = f"""
        <html>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f0f17; color: #e5e5e5; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 32px;">
              <div style="background: linear-gradient(135deg, #1e1e2e 0%, #16161d 100%); border-radius: 16px; padding: 32px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #818cf8; margin: 0; font-size: 24px;">📝 New Assignment</h1>
                </div>
                <p style="color: #d1d5db; font-size: 16px;">Hi <strong style="color: #f5f5f7;">{student_name}</strong>,</p>
                <p style="color: #d1d5db; font-size: 15px;">A new assignment has been posted for <strong style="color: #818cf8;">{subject_name}</strong>.</p>
                
                <div style="background: rgba(99, 102, 241, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid rgba(99, 102, 241, 0.15);">
                  <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Assignment</p>
                  <p style="margin: 0 0 16px 0; color: #f5f5f7; font-size: 18px; font-weight: 600;">{assignment_title}</p>
                  <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Deadline</p>
                  <p style="margin: 0; color: #f87171; font-size: 16px; font-weight: 600;">🕐 {deadline}</p>
                </div>

                <div style="text-align: center; margin: 28px 0;">
                  <a href="{submission_link}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
                    Submit Assignment →
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 13px; text-align: center;">Or copy this link: {submission_link}</p>
              </div>
              <p style="color: #4b5563; font-size: 12px; text-align: center; margin-top: 20px;">Sent via Campus Agents</p>
            </div>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()
        logger.info(f"Assignment notification sent to {to_email}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to send assignment email to {to_email}: {e}")
        return False


def send_deadline_reminder(to_email: str, student_name: str, assignment_title: str, deadline: str, submission_link: str):
    """Sends a deadline reminder email."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"SMTP credentials not found. Mocking reminder to {to_email}")
        logger.info(f"Reminder — Assignment: {assignment_title}, Deadline: {deadline}")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = f"⏰ Reminder: {assignment_title} — Deadline approaching!"

        body = f"""
        <html>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f0f17; color: #e5e5e5; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 32px;">
              <div style="background: linear-gradient(135deg, #1e1e2e 0%, #16161d 100%); border-radius: 16px; padding: 32px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #f87171; margin: 0; font-size: 24px;">⏰ Deadline Reminder</h1>
                </div>
                <p style="color: #d1d5db; font-size: 16px;">Hi <strong style="color: #f5f5f7;">{student_name}</strong>,</p>
                <p style="color: #d1d5db; font-size: 15px;">This is a reminder that the deadline for <strong style="color: #818cf8;">{assignment_title}</strong> is approaching.</p>
                
                <div style="background: rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid rgba(239, 68, 68, 0.2);">
                  <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Deadline</p>
                  <p style="margin: 0; color: #f87171; font-size: 20px; font-weight: 700;">🕐 {deadline}</p>
                </div>

                <div style="text-align: center; margin: 28px 0;">
                  <a href="{submission_link}" style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
                    Submit Now →
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 13px; text-align: center;">Or copy this link: {submission_link}</p>
              </div>
              <p style="color: #4b5563; font-size: 12px; text-align: center; margin-top: 20px;">Sent via Campus Agents</p>
            </div>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()
        logger.info(f"Deadline reminder sent to {to_email}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to send reminder email to {to_email}: {e}")
        return False
