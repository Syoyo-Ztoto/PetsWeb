const assert = require("assert");
const {
  calculateDistanceKm,
  filterPlaces,
  formatPlaceDistance,
  getStatusLabel,
  mergePlaces,
  normalizeAmapPoi,
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

assert.deepStrictEqual(
  filterPlaces(
    [
      {
        id: "route-too-far",
        name: "路线绕行地点",
        lat: 30.6,
        lng: 114.31,
        confidence: 70,
        petStatus: "unverified",
        routeDistanceMeters: 6800,
        routeDistanceKm: 6.8,
      },
    ],
    wuhanCenter,
    5
  ).map((place) => place.id),
  [],
  "filterPlaces should use route distance for radius filtering when available"
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

assert.strictEqual(
  formatPlaceDistance({ routeDistanceMeters: 2380, distanceKm: 1.8 }),
  "路线 2.4 km",
  "route distance should be preferred when AMap route data is available"
);

assert.strictEqual(
  formatPlaceDistance({
    routeDistanceMeters: 2380,
    drivingDurationSeconds: 780,
    distanceKm: 1.8,
  }),
  "路线 2.4 km · 驾车约 13 分钟",
  "driving duration should be shown when AMap driving route data is available"
);

assert.strictEqual(
  formatPlaceDistance({ distanceKm: 0.72 }),
  "直线 720 m",
  "straight-line distance should be clearly labeled as fallback"
);

const normalizedPoi = normalizeAmapPoi(
  {
    id: "B0FFFAKE",
    name: "武汉宠物友好咖啡",
    location: "114.305,30.61",
    type: "餐饮服务;咖啡厅;咖啡厅",
    address: "武汉市江岸区示例路1号",
    tel: [],
    photos: [{ url: "https://example.com/photo.jpg" }],
  },
  "咖啡"
);

assert.strictEqual(normalizedPoi.id, "amap-B0FFFAKE");
assert.strictEqual(normalizedPoi.lat, 30.61);
assert.strictEqual(normalizedPoi.lng, 114.305);
assert.strictEqual(normalizedPoi.category, "restaurant");
assert.strictEqual(normalizedPoi.categoryLabel, "餐饮/咖啡");
assert.strictEqual(normalizedPoi.phone, "暂无公开电话");
assert.strictEqual(normalizedPoi.image, "https://example.com/photo.jpg");
assert.strictEqual(normalizedPoi.petStatus, "unverified");

const normalizedObjectLocationPoi = normalizeAmapPoi(
  {
    id: "B0FFFUN",
    name: "汉口江滩三期",
    location: { lng: 114.315, lat: 30.608 },
    type: "风景名胜;公园广场;公园",
    address: [],
    tel: "027-12345678",
    photos: [],
  },
  "江滩"
);

assert.strictEqual(normalizedObjectLocationPoi.category, "lawn");
assert.strictEqual(normalizedObjectLocationPoi.address, "暂无地址");
assert.strictEqual(normalizedObjectLocationPoi.phone, "027-12345678");

const normalizedHotelPoi = normalizeAmapPoi(
  {
    id: "B0FFHOTEL",
    name: "武汉宠物友好酒店",
    location: "114.31,30.6",
    type: "住宿服务;宾馆酒店;宾馆酒店",
    address: "武汉市江岸区酒店路8号",
    tel: "027-88888888",
    photos: [],
  },
  "宠物友好酒店"
);

assert.strictEqual(normalizedHotelPoi.category, "hotel");
assert.strictEqual(normalizedHotelPoi.categoryLabel, "酒店/住宿");

const normalizedPetServicePoi = normalizeAmapPoi(
  {
    id: "B0FFPET",
    name: "萌宠生活馆",
    location: "114.32,30.6",
    type: "生活服务;宠物服务;宠物服务",
    address: "武汉市江岸区宠物路9号",
    tel: "027-66666666",
    photos: [],
  },
  "宠物服务"
);

assert.strictEqual(normalizedPetServicePoi.category, "pet");
assert.strictEqual(normalizedPetServicePoi.categoryLabel, "宠物服务");

const mergedPlaces = mergePlaces(
  [
    {
      id: "local-1",
      source: "local",
      name: "汉口江滩",
      address: "武汉市江岸区沿江大道",
      confidence: 86,
    },
  ],
  [
    {
      id: "amap-1",
      source: "amap",
      name: "汉口江滩",
      address: "武汉市江岸区沿江大道",
      confidence: 52,
    },
    {
      id: "amap-2",
      source: "amap",
      name: "东湖绿道",
      address: "武汉市武昌区东湖风景区",
      confidence: 61,
    },
  ]
);

assert.deepStrictEqual(
  mergedPlaces.map((place) => place.id),
  ["local-1", "amap-2"],
  "mergePlaces should keep trusted local records and add new AMap POIs"
);

console.log("placeLogic tests passed");
