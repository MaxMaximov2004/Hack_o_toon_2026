using System.Text.Json.Serialization;

namespace ExportService.Models
{
    /// <summary>Инвестпроект из GET /internal/projects (contracts/examples/projects-internal.json) — только то, что выгружаем.</summary>
    public class ProjectDto
    {
        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("initiator")]
        public string? Initiator { get; set; }

        [JsonPropertyName("municipalityName")]
        public string? MunicipalityName { get; set; }

        [JsonPropertyName("isKey")]
        public bool IsKey { get; set; }

        [JsonPropertyName("curator")]
        public string? Curator { get; set; }

        [JsonPropertyName("startYear")]
        public int? StartYear { get; set; }

        [JsonPropertyName("launchYear")]
        public int? LaunchYear { get; set; }

        [JsonPropertyName("amountMln")]
        public decimal? AmountMln { get; set; }

        [JsonPropertyName("jobs")]
        public int? Jobs { get; set; }

        [JsonPropertyName("stageName")]
        public string? StageName { get; set; }

        [JsonPropertyName("industryName")]
        public string? IndustryName { get; set; }

        [JsonPropertyName("recommendedOffers")]
        public List<RecommendedOfferDto>? RecommendedOffers { get; set; }
    }

    public class RecommendedOfferDto
    {
        [JsonPropertyName("needName")]
        public string? NeedName { get; set; }

        [JsonPropertyName("offers")]
        public List<string>? Offers { get; set; }
    }
}
