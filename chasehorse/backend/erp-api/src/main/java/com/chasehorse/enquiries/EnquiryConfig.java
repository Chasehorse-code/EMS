package com.chasehorse.enquiries;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(EnquirySettings.class)
class EnquiryConfig {}
