package ru.rt.radar.radar.filter;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import ru.rt.radar.common.exception.ValidationException;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ru.rt.radar.radar.filter.QueryString.filter;

class CompanyFilterParserTest {

    @Test
    void defaults() {
        CompanyFilter f = filter("");
        assertThat(f).isEqualTo(CompanyFilter.defaults());
        assertThat(f.client()).isEqualTo(ClientMode.ALL);
        assertThat(f.status()).isEqualTo(StatusMode.ACTIVE);
        assertThat(f.hasBounds()).isFalse();
    }

    @Test
    void foreignParamsIgnored() {
        assertThat(filter("zoom=7&page=0&size=50&sort=name,asc&format=csv")).isEqualTo(CompanyFilter.defaults());
    }

    @Test
    void allParams() {
        CompanyFilter f = filter("client=others&status=all&industry=trade&industry=logistics&revenueMin=10000000"
                + "&revenueMax=100000000&minLat=47.0&maxLat=47.5&minLon=39.0&maxLon=40.0&municipalityId=1"
                + "&municipalityId=7&sizeCategory=micro&growthMin=-5.5&isNew=true&q=%D0%94%D0%BE%D0%BD");
        assertThat(f.client()).isEqualTo(ClientMode.OTHERS);
        assertThat(f.status()).isEqualTo(StatusMode.ALL);
        assertThat(f.industries()).containsExactly(Industry.TRADE, Industry.LOGISTICS);
        assertThat(f.revenueMin()).isEqualByComparingTo("10000000");
        assertThat(f.revenueMax()).isEqualByComparingTo("100000000");
        assertThat(f.hasBounds()).isTrue();
        assertThat(List.of(f.minLat(), f.maxLat(), f.minLon(), f.maxLon())).containsExactly(47.0, 47.5, 39.0, 40.0);
        assertThat(f.municipalityIds()).containsExactly(1, 7);
        assertThat(f.sizeCategories()).containsExactly(SizeCategory.MICRO);
        assertThat(f.growthMin()).isEqualByComparingTo(new BigDecimal("-5.5"));
        assertThat(f.isNew()).isTrue();
        assertThat(f.q()).isEqualTo("Дон");
    }

    @Test
    void emptyValuesMeanNotSet() {
        assertThat(filter("client=&status=&industry=&revenueMin=&q=&isNew=&municipalityId="))
                .isEqualTo(CompanyFilter.defaults());
    }

    @Test
    void isNewFalseMeansNotSet() {
        assertThat(filter("isNew=false")).isEqualTo(CompanyFilter.defaults());
    }

    @Test
    void duplicatesInMultiRemoved() {
        assertThat(filter("industry=it&industry=it").industries()).containsExactly(Industry.IT);
    }

    @Test
    void valuesTrimmed() {
        assertThat(filter("q=%20%D0%BE%D0%BE%D0%BE%20").q()).isEqualTo("ооо");
    }

    @Test
    void fractionalRevenueAccepted() {
        // фронт переводит млн в рубли умножением — в JS это может дать хвост вида 100000.00000000001
        assertThat(filter("revenueMin=100000.00000000001").revenueMin()).isEqualByComparingTo("100000.00000000001");
    }

    @ParameterizedTest(name = "{0} → field={1}")
    @CsvSource(delimiter = '|', value = {
            "client=false                                   | client",
            "client=ours&client=others                      | client",
            "status=closed                                  | status",
            "industry=trade&industry=nope                   | industry",
            "industry=trade,logistics                       | industry",
            "sizeCategory=large                             | sizeCategory",
            "municipalityId=abc                             | municipalityId",
            "municipalityId=0                               | municipalityId",
            "revenueMin=abc                                 | revenueMin",
            "revenueMin=-1                                  | revenueMin",
            "revenueMin=200&revenueMax=100                  | revenueMin",
            "growthMin=ten                                  | growthMin",
            "isNew=yes                                      | isNew",
            "q=a                                            | q",
            "minLat=47&maxLat=48&minLon=39                  | maxLon",
            "maxLat=48                                      | minLat",
            "minLat=48&maxLat=47&minLon=39&maxLon=40        | minLat",
            "minLat=47&maxLat=47&minLon=39&maxLon=40        | minLat",
            "minLat=47&maxLat=48&minLon=40&maxLon=39        | minLon",
            "minLat=-91&maxLat=48&minLon=39&maxLon=40       | minLat",
            "minLat=47&maxLat=48&minLon=39&maxLon=181       | maxLon",
            "minLat=NaN&maxLat=48&minLon=39&maxLon=40       | minLat",
    })
    void invalid(String query, String field) {
        assertThatThrownBy(() -> filter(query))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> assertThat(((ValidationException) e).getField()).isEqualTo(field))
                .hasMessageNotContaining("null");
    }

    @Test
    void qTooLong() {
        assertThatThrownBy(() -> filter("q=" + "я".repeat(201)))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> assertThat(((ValidationException) e).getField()).isEqualTo("q"));
    }

    @Test
    void unknownCodeMessageListsAllowedValues() {
        assertThatThrownBy(() -> filter("client=false"))
                .hasMessageContaining("all, ours, others");
    }
}
