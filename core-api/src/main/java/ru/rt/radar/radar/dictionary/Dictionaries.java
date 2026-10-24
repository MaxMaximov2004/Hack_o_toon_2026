package ru.rt.radar.radar.dictionary;

import java.util.List;

/** Ответ GET /api/dictionaries. stages и needs — продукт 2, пока пустые. */
public record Dictionaries(
        List<CodeName> industries,
        List<Municipality> municipalities,
        List<CodeName> sizeCategories,
        List<CodeName> stages,
        List<CodeName> needs
) {

    public record CodeName(String code, String name) {
    }
}
