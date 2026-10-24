package ru.rt.radar.radar.filter;

/** Отрасль по первым двум цифрам основного ОКВЭД. Коды — из 00-common, не менять. */
public enum Industry implements CodedEnum {
    AGRO("agro", "Сельское хозяйство"),
    ENERGY("energy", "Добыча и энергетика"),
    MANUFACTURING("manufacturing", "Производство"),
    CONSTRUCTION("construction", "Строительство"),
    TRADE("trade", "Торговля"),
    LOGISTICS("logistics", "Транспорт и логистика"),
    HOSPITALITY("hospitality", "Гостиницы и общепит"),
    IT("it", "ИТ и связь"),
    REALESTATE("realestate", "Недвижимость"),
    SERVICES("services", "Услуги"),
    OTHER("other", "Прочее");

    private final String code;
    private final String title;

    Industry(String code, String title) {
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
