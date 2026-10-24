package ru.rt.radar.notifier.subscription;

import ru.rt.radar.notifier.project.ProjectEvent;

import java.time.OffsetDateTime;

/** Подписка на новые инвестпроекты. Порядок полей = contracts/examples/subscriptions.json. */
public record Subscription(long id, String industry, Integer municipalityId, String need, String stage,
                           OffsetDateTime createdAt) {

    /**
     * Проект подходит, если совпадают все заполненные поля подписки и он обновлён после её создания
     * (иначе подписка «на Ростов» сразу завалила бы ленту всеми старыми проектами).
     */
    public boolean matches(ProjectEvent p) {
        return p.updatedAt() != null && p.updatedAt().isAfter(createdAt)
                && (industry == null || industry.equals(p.industry()))
                && (municipalityId == null || municipalityId.equals(p.municipalityId()))
                && (need == null || (p.needs() != null && p.needs().contains(need)))
                && (stage == null || stage.equals(p.stage()));
    }
}
