package ru.rt.radar.invest;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Таймлайн над картой (docs/tz/08-product2-contract.md). Порядок полей = contracts/examples/timeline.json.
 * total — число проектов под фильтром (не событий); minYear/maxYear — по показанным событиям, нет событий — null.
 */
public record Timeline(Integer minYear, Integer maxYear, long total, List<Year> years) {

    public static final String START = "start";
    public static final String LAUNCH = "launch";

    public record Year(int year, List<Event> events) {
    }

    public record Event(int projectId, String type, String title, int municipalityId, String municipalityName,
                        String stage, Double amountMln) {
    }

    /** Внутри года: сначала start, затем по amountMln убыв. (пустой — в конце), затем по проекту. */
    static final Comparator<Event> IN_YEAR = Comparator
            .comparing((Event e) -> LAUNCH.equals(e.type()))
            .thenComparing(Event::amountMln, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparingInt(Event::projectId);

    /**
     * События start/launch проектов, если год известен. Задан период — только события внутри него
     * (проект при этом считается в total, даже если его событий в периоде нет).
     */
    static Timeline of(List<Project> projects, Integer yearFrom, Integer yearTo) {
        Map<Integer, List<Event>> byYear = new TreeMap<>();
        for (Project p : projects) {
            add(byYear, p, p.startYear(), START, yearFrom, yearTo);
            add(byYear, p, p.launchYear(), LAUNCH, yearFrom, yearTo);
        }
        List<Year> years = new ArrayList<>();
        byYear.forEach((year, events) -> {
            events.sort(IN_YEAR);
            years.add(new Year(year, List.copyOf(events)));
        });
        Integer min = years.isEmpty() ? null : years.get(0).year();
        Integer max = years.isEmpty() ? null : years.get(years.size() - 1).year();
        return new Timeline(min, max, projects.size(), years);
    }

    private static void add(Map<Integer, List<Event>> byYear, Project p, Integer year, String type,
                            Integer yearFrom, Integer yearTo) {
        if (year == null || (yearFrom != null && year < yearFrom) || (yearTo != null && year > yearTo)) {
            return;
        }
        byYear.computeIfAbsent(year, y -> new ArrayList<>()).add(new Event(p.id(), type, p.title(), p.municipalityId(),
                p.municipalityName(), p.stage(), p.amountMln()));
    }
}
