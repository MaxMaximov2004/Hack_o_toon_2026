package ru.rt.radar.invest;

import java.time.Instant;
import java.util.List;

/**
 * Инвестпроект (docs/tz/08-product2-contract.md, Project). Порядок полей = contracts/examples/project.json.
 * lat/lon — центр муниципалитета (своих координат у проекта нет). amountMln — млн руб. числом (8000.0, 17142.1).
 * updatedAt — ISO-8601 UTC с полной точностью БД (микросекунды): notifier передаёт его обратно в updatedSince.
 */
public record Project(
        int id,
        String title,
        String initiator,
        int municipalityId,
        String municipalityName,
        double lat,
        double lon,
        boolean isKey,
        String curator,
        Integer startYear,
        Integer launchYear,
        Double amountMln,
        Integer jobs,
        String stage,
        String stageName,
        String industry,
        String industryName,
        List<String> needs,
        List<RecommendedOffer> recommendedOffers,
        Instant updatedAt
) {

    /** Услуги РТ под потребность проекта (из core.need_offer). */
    public record RecommendedOffer(String need, String needName, List<String> offers) {
    }
}
