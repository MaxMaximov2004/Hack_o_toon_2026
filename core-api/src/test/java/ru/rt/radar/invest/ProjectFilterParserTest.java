package ru.rt.radar.invest;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import ru.rt.radar.common.exception.ValidationException;
import ru.rt.radar.radar.filter.Industry;
import ru.rt.radar.radar.filter.Need;
import ru.rt.radar.radar.filter.Stage;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProjectFilterParserTest {

    static ProjectFilter filter(String query) {
        Map<String, List<String>> tmp = new LinkedHashMap<>();
        if (!query.isEmpty()) {
            for (String pair : query.split("&")) {
                int eq = pair.indexOf('=');
                tmp.computeIfAbsent(eq < 0 ? pair : pair.substring(0, eq), k -> new ArrayList<>())
                        .add(eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
            }
        }
        Map<String, String[]> params = new LinkedHashMap<>();
        tmp.forEach((k, v) -> params.put(k, v.toArray(String[]::new)));
        return ProjectFilterParser.parse(params);
    }

    @Test
    void defaultsAndForeignParamsIgnored() {
        assertThat(filter("")).isEqualTo(ProjectFilter.defaults());
        assertThat(filter("page=0&size=50&sort=amountMln,desc&updatedSince=2026-01-01T00:00:00Z&format=csv"))
                .isEqualTo(ProjectFilter.defaults());
        assertThat(filter("stage=&isKey=&q=&isKey=false")).isEqualTo(ProjectFilter.defaults());
    }

    @Test
    void allParams() {
        ProjectFilter f = filter("stage=design&stage=launch&industry=logistics&need=apcs&need=it_infra&need=apcs"
                + "&municipalityId=53&yearFrom=2024&yearTo=2026&isKey=true&amountMin=100.5&q=%D0%B7%D0%B0%D0%B2%D0%BE%D0%B4");
        assertThat(f.stages()).containsExactly(Stage.DESIGN, Stage.LAUNCH);
        assertThat(f.industries()).containsExactly(Industry.LOGISTICS);
        assertThat(f.needs()).containsExactly(Need.APCS, Need.IT_INFRA);
        assertThat(f.municipalityIds()).containsExactly(53);
        assertThat(f.yearFrom()).isEqualTo(2024);
        assertThat(f.yearTo()).isEqualTo(2026);
        assertThat(f.isKey()).isTrue();
        assertThat(f.amountMin()).isEqualByComparingTo("100.5");
        assertThat(f.q()).isEqualTo("завод");
    }

    @ParameterizedTest(name = "{0} → field={1}")
    @CsvSource(delimiter = '|', value = {
            "stage=building                 | stage",
            "industry=nope                  | industry",
            "need=internet                  | need",
            "need=apcs,it_infra             | need",
            "municipalityId=0               | municipalityId",
            "yearFrom=abc                   | yearFrom",
            "yearTo=1800                    | yearTo",
            "yearFrom=2027&yearTo=2025      | yearFrom",
            "yearFrom=2020&yearFrom=2021    | yearFrom",
            "isKey=yes                      | isKey",
            "amountMin=-1                   | amountMin",
            "amountMin=много                | amountMin",
            "q=a                            | q",
    })
    void invalid(String query, String field) {
        assertThatThrownBy(() -> filter(query))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> assertThat(((ValidationException) e).getField()).isEqualTo(field));
    }
}
