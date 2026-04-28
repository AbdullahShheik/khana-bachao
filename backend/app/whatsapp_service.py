import os
import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from fastapi import HTTPException, status
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Load Twilio credentials from environment variables
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")

# Initialize client only if credentials exist
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

def send_whatsapp_verification(to_number: str, token: str):
    """
    Sends a WhatsApp verification code using the Twilio API.
    """
    if not twilio_client:
        logger.error("Twilio credentials not configured.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="WhatsApp service is not configured properly."
        )

    # Format the number for Twilio's WhatsApp API
    # Twilio requires the number to be in E.164 format prefixed with 'whatsapp:'
    formatted_number = to_number.strip()
    
    # Handle local Pakistani numbers starting with 03
    if formatted_number.startswith("03"):
        formatted_number = f"+92{formatted_number[1:]}"
        
    if not formatted_number.startswith("+"):
        formatted_number = f"+{formatted_number}"
        
    if not formatted_number.startswith("whatsapp:"):
        formatted_number = f"whatsapp:{formatted_number}"

    message_body = f"Your Khana Bachao verification code is: {token}. Please enter this to complete your registration."

    try:
        message = twilio_client.messages.create(
            body=message_body,
            from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
            to=formatted_number
        )
        logger.info(f"WhatsApp OTP sent to {to_number}. Message SID: {message.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"Failed to send WhatsApp verification to {to_number}: {e}")
        # Return a 400 error for invalid numbers, opt-outs, out of funds, etc.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to send WhatsApp verification. Please ensure the number is valid and registered with WhatsApp."
        )
    except Exception as e:
        logger.error(f"Unexpected error sending WhatsApp verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error occurred while sending WhatsApp verification."
        )
