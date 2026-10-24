package ru.rt.radar.common.security;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Тестовые токены, подписанные dev-ключом из contracts/dev-keys (как mint-token.sh),
 * и HTTP-сервер, отдающий contracts/dev-keys/jwks.json — как GET /internal/auth/jwks у auth-service.
 */
final class DevTokens {

    private static final Path KEYS = Path.of("..", "contracts", "dev-keys");
    private static final PrivateKey DEV_KEY = readPkcs8(KEYS.resolve("jwt-dev-private.pem"));

    private DevTokens() {
    }

    /** Токен как после входа с 2FA. */
    static String valid(String... roles) {
        return sign(DEV_KEY, claims(RadarJwtValidators.ISSUER, List.of("pwd", "otp"), 3600, roles));
    }

    static String withoutOtp() {
        return sign(DEV_KEY, claims(RadarJwtValidators.ISSUER, List.of("pwd"), 3600, "manager"));
    }

    static String withIssuer(String issuer) {
        return sign(DEV_KEY, claims(issuer, List.of("pwd", "otp"), 3600, "manager"));
    }

    static String expired() {
        return sign(DEV_KEY, claims(RadarJwtValidators.ISSUER, List.of("pwd", "otp"), -600, "manager"));
    }

    /** Подписан чужим ключом, но с тем же kid. */
    static String foreignKey() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            return sign(gen.generateKeyPair().getPrivate(), claims(RadarJwtValidators.ISSUER, List.of("pwd", "otp"), 3600, "manager"));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Сервер с JWKS на случайном порту; адрес — {@code http://127.0.0.1:<port>/internal/auth/jwks}. */
    static String startJwksServer() {
        try {
            byte[] jwks = Files.readAllBytes(KEYS.resolve("jwks.json"));
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/internal/auth/jwks", exchange -> {
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, jwks.length);
                exchange.getResponseBody().write(jwks);
                exchange.close();
            });
            server.start();
            return "http://127.0.0.1:" + server.getAddress().getPort() + "/internal/auth/jwks";
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static JWTClaimsSet claims(String issuer, List<String> amr, long ttlSeconds, String... roles) {
        Instant now = Instant.now();
        return new JWTClaimsSet.Builder()
                .issuer(issuer).subject("1").claim("email", "demo@rt.ru").claim("name", "Демо Менеджер")
                .claim("roles", List.of(roles)).claim("amr", amr)
                .issueTime(Date.from(now.minusSeconds(Math.max(0, -ttlSeconds) + 60)))
                .expirationTime(Date.from(now.plusSeconds(ttlSeconds)))
                .jwtID(UUID.randomUUID().toString())
                .build();
    }

    private static String sign(PrivateKey key, JWTClaimsSet claims) {
        try {
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("dev-1").type(JOSEObjectType.JWT).build(), claims);
            jwt.sign(new RSASSASigner(key));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static PrivateKey readPkcs8(Path pem) {
        try {
            String base64 = Files.readString(pem).replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
            return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (Exception e) {
            throw new IllegalStateException("Не прочитан " + pem, e);
        }
    }
}
