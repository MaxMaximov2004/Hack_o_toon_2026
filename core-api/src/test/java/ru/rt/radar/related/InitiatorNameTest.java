package ru.rt.radar.related;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/** Пары «инициатор проекта (лист МОД2) — название в реестре МСП» из реальных данных. */
class InitiatorNameTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            ООО «РЫБНАЯ ФЕРМА «ЭКОДОН»                    | ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "РЫБНАЯ ФЕРМА "ЭКОДОН""
            ИП Пономарев Евгений Вячеславович             | ПОНОМАРЁВ ЕВГЕНИЙ ВЯЧЕСЛАВОВИЧ
            ООО СЗ "КОРИФЕЙ"                              | ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ СПЕЦИАЛИЗИРОВАННЫЙ ЗАСТРОЙЩИК "КОРИФЕЙ"
            АО "Ростовский порт"                          | АКЦИОНЕРНОЕ ОБЩЕСТВО "РОСТОВСКИЙ ПОРТ"
            ООО " Морской воздух"                         | ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ"МОРСКОЙ ВОЗДУХ"
            ООО "2Т Моторс"                               | ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "2Т МОТОРС"
            Индивидуальный предприниматель Тараненко В А  | ТАРАНЕНКО В А
            ГК "Бештау"                                   | ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "БЕШТАУ"
            """)
    void sameCompany(String initiator, String registry) {
        assertThat(InitiatorName.normalize(initiator)).isEqualTo(InitiatorName.normalize(registry)).isNotEmpty();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            ООО КЗ «Ростсельмаш»   | ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "РОСТСЕЛЬМАШ"
            ООО "Агротранс"        | ООО "АГРОТРАНС ПЛЮС"
            """)
    void differentCompanies(String initiator, String registry) {
        assertThat(InitiatorName.normalize(initiator)).isNotEqualTo(InitiatorName.normalize(registry));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            ООО "Северо-Кавказское логистическое предприятие" | северо-кавказское
            ИП Ли Ан                                           |
            """)
    void longestTokenForSqlPrefilter(String name, String token) {
        assertThat(InitiatorName.longestToken(InitiatorName.normalize(name))).isEqualTo(token);
    }
}
