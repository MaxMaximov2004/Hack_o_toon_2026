package ru.rt.radar.notifier.subscription;

import ru.rt.radar.notifier.common.exception.ValidationException;

import java.util.List;

import static ru.rt.radar.notifier.common.util.LogPatterns.MUNICIPALITY_INVALID;
import static ru.rt.radar.notifier.common.util.LogPatterns.SUBSCRIPTION_EMPTY;
import static ru.rt.radar.notifier.common.util.LogPatterns.UNKNOWN_CODE;

/** Тело POST /api/subscriptions: хотя бы одно поле (иначе 400, как во всех сервисах — не 422). */
public record SubscriptionRequest(String industry, Integer municipalityId, String need, String stage) {

    public void validate() {
        if (industry == null && municipalityId == null && need == null && stage == null) {
            throw new ValidationException("industry", SUBSCRIPTION_EMPTY);
        }
        code("industry", industry, Codes.INDUSTRIES);
        code("need", need, Codes.NEEDS);
        code("stage", stage, Codes.STAGES);
        if (municipalityId != null && municipalityId <= 0) {
            throw new ValidationException("municipalityId", MUNICIPALITY_INVALID);
        }
    }

    private static void code(String field, String value, List<String> allowed) {
        if (value != null && !allowed.contains(value)) {
            throw new ValidationException(field, String.format(UNKNOWN_CODE, field, value, String.join(", ", allowed)));
        }
    }
}
