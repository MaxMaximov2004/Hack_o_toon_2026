package ru.rt.radar.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Только для тестов: эндпоинты под каждое правило доступа SecurityConfig. */
@RestController
class SecurityProbeController {

    @GetMapping("/api/test/whoami")
    List<String> whoami(Authentication auth) {
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).sorted().toList();
    }

    @GetMapping("/internal/test/probe")
    String internal() {
        return "ok";
    }

    // TEMP: убрать, когда появится настоящий POST /api/clients/import (clients/, Java #2) — иначе два маппинга
    @PostMapping("/api/clients/import")
    String adminOnly() {
        return "ok";
    }
}
