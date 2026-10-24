package ru.rt.radar.radar.filter;

/** Потребность инвестпроекта → услуги РТ из core.need_offer (продукт 2, docs/tz/08-product2-contract.md). Коды не менять. */
public enum Need implements CodedEnum {
    IT_INFRA("it_infra", "ИТ-инфраструктура и связь"),
    APCS("apcs", "АСУ ТП и промышленный интернет вещей"),
    PHYS_SECURITY("phys_security", "Физическая безопасность"),
    INFO_SECURITY("info_security", "Информационная безопасность");

    private final String code;
    private final String title;

    Need(String code, String title) {
        this.code = code;
        this.title = title;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public String title() {
        return title;
    }
}
