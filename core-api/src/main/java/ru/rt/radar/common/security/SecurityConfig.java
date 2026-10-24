package ru.rt.radar.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import ru.rt.radar.common.dto.error.ErrorCode;

import java.time.Duration;
import java.util.List;
import java.util.Locale;

import static ru.rt.radar.common.util.LogPatterns.*;

/**
 * Безопасность core-api (docs/tz/03-java-2-techlead.md, «common/»):
 * <ul>
 *   <li>/api/** — JWT RS256 от auth-service, ключи по AUTH_JWKS_URL (лениво, при первом запросе — сервис стартует
 *       без auth-service), проверки — {@link RadarJwtValidators};</li>
 *   <li>POST /api/clients/import — роль admin (claim roles);</li>
 *   <li>/internal/** — без JWT, но с X-Internal-Token ({@link InternalTokenFilter});</li>
 *   <li>/health, Swagger — открыты.</li>
 * </ul>
 * Сессий, CSRF и CORS нет: токен в каждом запросе, фронт с API на одном домене через nginx.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    /** Сосед не ответил за 5 с → 502 (00-common, таблица ошибок). */
    private static final Duration JWKS_TIMEOUT = Duration.ofSeconds(5);

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper,
                                            @Value("${radar.internal-token:}") String internalToken) throws Exception {
        SecurityErrorWriter errors = new SecurityErrorWriter(mapper);
        if (!StringUtils.hasText(internalToken)) {
            log.warn(INTERNAL_TOKEN_MISSING);
        }
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/health", "/error").permitAll()
                        .requestMatchers("/swagger-ui", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/internal/**").permitAll()          // проверяет InternalTokenFilter
                        .requestMatchers(HttpMethod.POST, "/api/clients/import").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(rolesConverter()))
                        .authenticationEntryPoint(authenticationEntryPoint(errors))
                        .accessDeniedHandler(accessDeniedHandler(errors)))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(authenticationEntryPoint(errors))
                        .accessDeniedHandler(accessDeniedHandler(errors)))
                .addFilterBefore(new InternalTokenFilter(internalToken, errors), BearerTokenAuthenticationFilter.class)
                .build();
    }

    /**
     * Декодер с проверкой подписи по JWKS auth-service. Ключи запрашиваются при первом токене и кэшируются;
     * при неизвестном kid Nimbus перезапрашивает JWKS сам. auth-service недоступен → {@link JwksUnavailableException} → 502.
     */
    @Bean
    JwtDecoder jwtDecoder(@Value("${radar.auth-jwks-url:}") String jwksUrl) {
        if (!StringUtils.hasText(jwksUrl)) {
            log.warn(JWKS_URL_MISSING);
            return token -> {
                throw new BadJwtException("AUTH_JWKS_URL не задан");
            };
        }
        SimpleClientHttpRequestFactory http = new SimpleClientHttpRequestFactory();
        http.setConnectTimeout(JWKS_TIMEOUT);
        http.setReadTimeout(JWKS_TIMEOUT);
        NimbusJwtDecoder nimbus = NimbusJwtDecoder.withJwkSetUri(jwksUrl)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .restOperations(new RestTemplate(http))
                .build();
        nimbus.setJwtValidator(RadarJwtValidators.create());
        return token -> {
            try {
                return nimbus.decode(token);
            } catch (BadJwtException e) {
                throw e;                                   // плохой токен → 401
            } catch (JwtException e) {
                throw new JwksUnavailableException(e.getMessage(), e);   // не достучались до JWKS → 502
            }
        };
    }

    /** roles: ["manager","admin"] → ROLE_MANAGER, ROLE_ADMIN. */
    private static JwtAuthenticationConverter rolesConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("roles");
            return roles == null ? List.of() : roles.stream()
                    .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r.toUpperCase(Locale.ROOT)))
                    .toList();
        });
        return converter;
    }

    /** Нет токена / плохой токен → 401; не достучались до auth-service → 502. */
    private static AuthenticationEntryPoint authenticationEntryPoint(SecurityErrorWriter errors) {
        return (request, response, ex) -> {
            if (hasCause(ex, JwksUnavailableException.class)) {
                errors.write(request, response, HttpStatus.BAD_GATEWAY, ErrorCode.UPSTREAM_UNAVAILABLE,
                        AUTH_UNAVAILABLE, ex.getMessage());
            } else if (request.getHeader("Authorization") == null) {
                errors.write(request, response, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED,
                        AUTH_REQUIRED, "нет заголовка Authorization");
            } else {
                errors.write(request, response, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED,
                        TOKEN_INVALID, ex.getMessage());
            }
        };
    }

    private static AccessDeniedHandler accessDeniedHandler(SecurityErrorWriter errors) {
        return (request, response, ex) -> errors.write(request, response, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                ACCESS_DENIED, ex.getMessage());
    }

    private static boolean hasCause(AuthenticationException ex, Class<? extends Throwable> type) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (type.isInstance(t)) {
                return true;
            }
        }
        return false;
    }
}
