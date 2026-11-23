package com.chasehorse.enquiries;

import java.util.Locale;

/** Every website form that feeds the Enquiry Management System. */
public enum EnquiryFormType {
    CONTACT("Contact us"),
    ENQUIRY_POPUP("Consultation request"),
    HERO_ENQUIRY("Home page enquiry"),
    NETWORK_ENQUIRY("Logistics network enquiry"),
    BLUEPRINT("Design Your Solution blueprint"),
    PARTNER_ONFIELD("On-field partner onboarding"),
    PARTNER_TRANSPORT("Transport partner application"),
    PARTNER_TERMINAL("Terminal partner application"),
    CAREERS("Job application"),
    BOOK_TRUCK("Truck booking request"),
    ONFIELD_LEAD("On-field lead deployment"),
    TERMINAL_SPACE("Terminal space reservation"),
    TRIP_FINANCE("Trip finance application"),
    HSE_CALLBACK("HSE shop callback request"),
    HSE_ONSITE_STORE("HSE on-site store request");

    private final String label;

    EnquiryFormType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static EnquiryFormType parse(String raw) {
        try {
            return valueOf(raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw com.chasehorse.common.ApiException.badRequest("Unknown form type");
        }
    }
}
