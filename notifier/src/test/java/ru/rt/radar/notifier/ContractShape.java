package ru.rt.radar.notifier;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Сверка формы ответа с примером из contracts/examples: те же ключи в том же порядке, те же JSON-типы,
 * у чисел — то же «целое / дробное». Значение null с любой стороны тип не проверяет (поле всё равно обязано быть).
 */
public final class ContractShape {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path EXAMPLES = Path.of("..", "contracts", "examples");

    private ContractShape() {
    }

    public static JsonNode example(String file) {
        try {
            return JSON.readTree(EXAMPLES.resolve(file).toFile());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static void assertMatches(String exampleFile, String actualJson) {
        try {
            assertMatches(example(exampleFile), JSON.readTree(actualJson), exampleFile);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void assertMatches(JsonNode example, JsonNode actual, String path) {
        if (example.isNull() || actual.isNull()) {
            return;
        }
        assertThat(actual.getNodeType()).as("тип %s", path).isEqualTo(example.getNodeType());
        if (example.isNumber()) {
            assertThat(actual.isIntegralNumber()).as("целое/дробное %s (пример %s, ответ %s)", path, example, actual)
                    .isEqualTo(example.isIntegralNumber());
        } else if (example.isObject()) {
            assertThat(names(actual)).as("ключи %s", path).containsExactlyElementsOf(names(example));
            example.fieldNames().forEachRemaining(f -> assertMatches(example.get(f), actual.get(f), path + "." + f));
        } else if (example.isArray() && !example.isEmpty()) {
            for (int i = 0; i < actual.size(); i++) {
                assertMatches(example.get(0), actual.get(i), path + "[" + i + "]");
            }
        }
    }

    private static List<String> names(JsonNode node) {
        List<String> result = new ArrayList<>();
        node.fieldNames().forEachRemaining(result::add);
        return result;
    }
}
