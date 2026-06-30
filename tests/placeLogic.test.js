const assert = require("assert");
const {
  calculateDistanceKm,
  filterPlaces,
  getStatusLabel,
} = require("../src/placeLogic");

const wuhanCenter = { lat: 30.5928, lng: 114.3055 };

const places = [
  {
    id: "near-confirmed",
    name: "汉口江滩",
    lat: 30.6076,
    lng: 114.313,
    confidence: 86,
    petStatus: "confirmed",
  },
  {
    id: "far-candidate",
    name: "远处草坪",
    lat: 30.9,
    lng: 114.7,
    confidence: 42,
    petStatus: "unverified",
  },
];

assert(
  calculateDistanceKm(wuhanCenter, places[0]) > 1 &&
    calculateDistanceKm(wuhanCenter, places[0]) < 3,
  "distance calculation should return realistic kilometers in Wuhan"
);

assert.deepStrictEqual(
  filterPlaces(places, wuhanCenter, 5).map((place) => place.id),
  ["near-confirmed"],
  "filterPlaces should only return places within the selected radius"
);

assert.strictEqual(
  getStatusLabel({ petStatus: "confirmed", confidence: 86 }),
  "已确认可带狗",
  "confirmed places should use a clear user-facing label"
);

assert.strictEqual(
  getStatusLabel({ petStatus: "unknown", confidence: 15 }),
  "信息不足，建议先电话确认",
  "unknown places should guide users to confirm before visiting"
);

console.log("placeLogic tests passed");
