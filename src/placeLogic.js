(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PlaceLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const EARTH_RADIUS_KM = 6371;

  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function calculateDistanceKm(origin, place) {
    const lat1 = toRadians(origin.lat);
    const lat2 = toRadians(place.lat);
    const deltaLat = toRadians(place.lat - origin.lat);
    const deltaLng = toRadians(place.lng - origin.lng);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  function enrichWithDistance(place, origin) {
    return {
      ...place,
      distanceKm: calculateDistanceKm(origin, place),
    };
  }

  function filterPlaces(places, origin, radiusKm, category) {
    return places
      .map((place) => enrichWithDistance(place, origin))
      .filter((place) => place.distanceKm <= radiusKm)
      .filter((place) => !category || category === "all" || place.category === category)
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.distanceKm - b.distanceKm;
      });
  }

  function getStatusLabel(place) {
    if (place.petStatus === "confirmed" && place.confidence >= 80) {
      return "已确认可带狗";
    }
    if (place.petStatus === "recent") {
      return "近期有人带狗";
    }
    if (place.petStatus === "limited") {
      return "可带狗但有限制";
    }
    if (place.petStatus === "unverified") {
      return "待确认";
    }
    return "信息不足，建议先电话确认";
  }

  function getConfidenceTone(confidence) {
    if (confidence >= 80) return "strong";
    if (confidence >= 55) return "medium";
    if (confidence >= 30) return "weak";
    return "unknown";
  }

  function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  return {
    calculateDistanceKm,
    filterPlaces,
    getStatusLabel,
    getConfidenceTone,
    formatDistance,
  };
});
