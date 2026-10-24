package ru.rt.radar.common.security;

import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidators;

import java.util.List;

import static ru.rt.radar.common.util.LogPatterns.OTP_MISSING;

/**
 * Какой accessToken принимаем (docs/tz/00-common.md, «Авторизация»): подпись RS256 по JWKS проверяет декодер,
 * здесь — exp/nbf (с запасом 60 с), iss = radar-auth и обязательный второй фактор: в amr есть "otp".
 */
public final class RadarJwtValidators {

    public static final String ISSUER = "radar-auth";

    private RadarJwtValidators() {
    }

    public static OAuth2TokenValidator<Jwt> create() {
        return new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(ISSUER), RadarJwtValidators::otp);
    }

    private static OAuth2TokenValidatorResult otp(Jwt jwt) {
        List<String> amr = jwt.getClaimAsStringList("amr");
        return amr != null && amr.contains("otp")
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", OTP_MISSING, null));
    }
}
