package ru.rt.radar.related;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import ru.rt.radar.radar.company.CompanyShort;

import java.util.List;

/** GET /api/projects/{id}/related-companies. Порядок полей = contracts/examples/related-companies.json. */
public record RelatedCompanies(int projectId, List<Item> items, long sameAreaIndustryTotal, String radarQuery) {

    public static final String INITIATOR = "initiator";
    public static final String SAME_AREA_INDUSTRY = "same_area_industry";

    /** CompanyShort как в списке компаний + relation. */
    public record Item(@JsonUnwrapped CompanyShort company, String relation) {
    }
}
