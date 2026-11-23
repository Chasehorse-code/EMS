package com.chasehorse.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuditJsonEscapingTest {

    @Test
    @DisplayName("Audit metadata escapes quotes, backslashes and control characters (e.g. multi-line reasons)")
    void escapesForJson() {
        String escaped = AuditService.escapeJson("Line one\nLine \"two\"\t\\ end\u0001");
        assertThat(escaped).isEqualTo("Line one\\nLine \\\"two\\\"\\t\\\\ end\\u0001");
    }
}
