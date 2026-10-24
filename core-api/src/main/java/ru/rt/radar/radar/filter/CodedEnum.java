package ru.rt.radar.radar.filter;

import ru.rt.radar.common.exception.ValidationException;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/** Справочное значение с кодом из контракта (00-common) и русским названием. */
public interface CodedEnum {

    String code();

    String title();

    static <E extends Enum<E> & CodedEnum> E fromCode(Class<E> type, String code, String field) {
        for (E e : type.getEnumConstants()) {
            if (e.code().equals(code)) {
                return e;
            }
        }
        throw new ValidationException(field,
                "Неизвестное значение " + field + "='" + code + "', допустимо: " + String.join(", ", codes(type)));
    }

    /** Поиск без ошибки — для значений из БД. */
    static <E extends Enum<E> & CodedEnum> Optional<E> find(Class<E> type, String code) {
        return Arrays.stream(type.getEnumConstants()).filter(e -> e.code().equals(code)).findFirst();
    }

    static <E extends Enum<E> & CodedEnum> List<String> codes(Class<E> type) {
        return Arrays.stream(type.getEnumConstants()).map(CodedEnum::code).collect(Collectors.toList());
    }
}
