package com.chasehorse.enquiries;

/** Delivers an e-mail verification code. Implementations must not log the code in production. */
public interface OtpMailer {
    /** @throws OtpDeliveryException if the code could not be handed to the mail server */
    void sendCode(String email, String code, int validMinutes);

    class OtpDeliveryException extends RuntimeException {
        public OtpDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
