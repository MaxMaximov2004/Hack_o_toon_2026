package ru.rt.radar.clients;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class ClientCsvParserTest {

    private static ClientCsvParser.Result parse(String csv) {
        return ClientCsvParser.parse(csv.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void headerInnSemicolonBomQuotesAndOtherColumns() {
        var r = parse("﻿Название;ИНН;Город\r\n\"ООО \"\"Ромашка\"\"; филиал\";6164123457;Ростов\r\n\r\nИП Иванов;616500123456;Азов\r\n");
        assertThat(r.rows()).isEqualTo(2);                      // заголовок и пустая строка не считаются
        assertThat(r.inns()).containsExactly("6164123457", "616500123456");
        assertThat(r.invalid()).isEmpty();
    }

    @Test
    void commaAndLatinHeaderCaseInsensitive() {
        var r = parse("name,INN\nA,6164123457\nB,6164123457\n");
        assertThat(r.rows()).isEqualTo(2);
        assertThat(r.inns()).containsExactly("6164123457");    // дубль убран
    }

    @Test
    void noHeaderFirstColumn() {
        var r = parse("6164123457;ООО А\n616500123456;ИП Б\n");
        assertThat(r.rows()).isEqualTo(2);
        assertThat(r.inns()).containsExactly("6164123457", "616500123456");
    }

    @Test
    void unknownHeaderSkippedTakesFirstColumn() {
        var r = parse("Код;Название\n6164123457;А\n");
        assertThat(r.rows()).isEqualTo(1);
        assertThat(r.inns()).containsExactly("6164123457");
    }

    @Test
    void invalidGoToInvalidInFileOrder() {
        var r = parse("inn\n123\n6164123457\n61-6412-3457\n\n  \nабв\n");
        assertThat(r.rows()).isEqualTo(4);
        assertThat(r.inns()).containsExactly("6164123457");
        assertThat(r.invalid()).containsExactly("123", "61-6412-3457", "абв");
    }

    @Test
    void emptyAndHeaderOnly() {
        assertThat(parse("").rows()).isZero();
        assertThat(parse("﻿\n\n").rows()).isZero();
        assertThat(parse("inn\n").rows()).isZero();
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource(delimiter = '|', value = {
            "6164123457      | 6164123457",
            "616500123456    | 616500123456",
            "100000009       | 0100000009",     // Excel съел ведущий ноль у ИНН юрлица
            "16500123456     | 016500123456",
            "' 6164123457 '  | 6164123457",
            "12345678        | ",
            "1234567890123   | ",
            "61641234 57     | ",
            "６１６４１２３４５７ | ",             // «полноширинные» цифры — не ИНН
    })
    void normalizeInn(String raw, String expected) {
        assertThat(ClientCsvParser.normalizeInn(raw)).isEqualTo(expected);
    }
}
