package ru.rt.radar.locations;

/**
 * Тело POST /api/companies/{id}/locations: ровно одно из municipalityName (район или город области — как в
 * /api/dictionaries) и regionName (другой регион). address и note — по желанию.
 */
public record LocationRequest(String municipalityName, String regionName, String address, String note) {
}
