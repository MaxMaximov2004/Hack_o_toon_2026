package ru.rt.radar.notifier.subscription;

import java.util.List;

/** Коды справочников — те же, что в core-api и docs/tz/00-common.md, 08-product2-contract.md. */
public final class Codes {

    public static final List<String> INDUSTRIES = List.of("agro", "energy", "manufacturing", "construction", "trade",
            "logistics", "hospitality", "it", "realestate", "services", "other");
    public static final List<String> STAGES = List.of("design", "construction", "launch");
    public static final List<String> NEEDS = List.of("it_infra", "apcs", "phys_security", "info_security");

    private Codes() {
    }
}
