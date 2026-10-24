package ru.rt.radar.radar.dictionary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.radar.dictionary.Dictionaries.CodeName;
import ru.rt.radar.radar.filter.CodedEnum;
import ru.rt.radar.radar.filter.Industry;
import ru.rt.radar.radar.filter.Need;
import ru.rt.radar.radar.filter.SizeCategory;
import ru.rt.radar.radar.filter.Stage;

import java.util.Arrays;
import java.util.List;

@RestController
@Tag(name = "Справочники")
public class DictionaryController {

    private static final List<CodeName> INDUSTRIES = codeNames(Industry.class);
    private static final List<CodeName> SIZE_CATEGORIES = codeNames(SizeCategory.class);
    private static final List<CodeName> STAGES = codeNames(Stage.class);
    private static final List<CodeName> NEEDS = codeNames(Need.class);

    private final MunicipalityRepository municipalities;

    public DictionaryController(MunicipalityRepository municipalities) {
        this.municipalities = municipalities;
    }

    @GetMapping("/api/dictionaries")
    @Operation(summary = "Справочники: отрасли, районы и города, категории МСП, стадии и потребности проектов",
            description = "Коды отраслей и категорий — из контракта (00-common), стадий и потребностей — из 08-product2-contract. "
                    + "Районы — из БД, кэш 60 с.")
    public Dictionaries dictionaries() {
        return new Dictionaries(INDUSTRIES, municipalities.findAll(), SIZE_CATEGORIES, STAGES, NEEDS);
    }

    private static <E extends Enum<E> & CodedEnum> List<CodeName> codeNames(Class<E> type) {
        return Arrays.stream(type.getEnumConstants()).map(e -> new CodeName(e.code(), e.title())).toList();
    }
}
