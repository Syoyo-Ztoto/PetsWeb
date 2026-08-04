const assert = require("assert");
const {
  calculateDistanceKm,
  buildAmapNavigationUrl,
  buildImageSearchQuery,
  filterPlaces,
  groupSearchResults,
  formatPlaceDistance,
  getStatusLabel,
  isRelevantPlaceForCategory,
  isRelevantLeisurePlace,
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

assert.strictEqual(
  buildAmapNavigationUrl({
    name: "亚朵酒店",
    address: "江汉区示例路100号",
    lat: 30.61,
    lng: 114.31,
  }),
  "https://uri.amap.com/navigation?to=114.31,30.61,%E6%AD%A6%E6%B1%89%E4%BA%9A%E6%9C%B5%E9%85%92%E5%BA%97&mode=car&policy=1&src=PetsWeb&coordinate=gaode&callnative=1",
  "navigation should target exact AMap coordinates and prefix Wuhan in the displayed destination name"
);

assert.strictEqual(
  buildAmapNavigationUrl({
    name: "亚朵酒店",
    address: "江汉区示例路100号",
  }),
  "https://uri.amap.com/search?keyword=%E6%AD%A6%E6%B1%89%20%E4%BA%9A%E6%9C%B5%E9%85%92%E5%BA%97%20%E6%B1%9F%E6%B1%89%E5%8C%BA%E7%A4%BA%E4%BE%8B%E8%B7%AF100%E5%8F%B7&city=%E6%AD%A6%E6%B1%89",
  "fallback search should still include Wuhan city context"
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
  isRelevantLeisurePlace({
    name: "汉口江滩停车场",
    type: "交通设施服务;停车场;停车场",
    category: "lawn",
  }),
  false,
  "parking lots near a riverside park should not appear as dog-walking recommendations"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "汉口江滩篮球场",
    type: "体育休闲服务;运动场馆;篮球场馆",
    category: "lawn",
  }),
  false,
  "basketball courts should not appear as lawn or riverside dog-walking recommendations"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "滨江足球场",
    type: "体育休闲服务;运动场馆;足球场",
    category: "lawn",
  }),
  false,
  "sports fields with riverside keywords should not appear as leisure dog-walking places"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "汉口江滩幼儿园",
    type: "科教文化服务;学校;幼儿园",
    category: "lawn",
  }),
  false,
  "schools and kindergartens should not appear as leisure walking places"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "武汉滨江石油加油站",
    type: "汽车服务;加油站;加油站",
    category: "lawn",
  }),
  false,
  "gas stations with riverside names should not appear as dog-walking recommendations"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "山间棠亲子健康调理馆二七滨江店",
    type: "生活服务;生活服务场所;生活服务场所",
    category: "lawn",
  }),
  false,
  "business venues with riverside branch names should not appear as leisure walking places"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "江滩综合办事处",
    type: "政府机构及社会团体;政府机关;政府机关",
    category: "lawn",
  }),
  false,
  "offices should not appear even when the name contains riverside keywords"
);

assert.strictEqual(
  isRelevantLeisurePlace({
    name: "汉口江滩三期",
    type: "风景名胜;公园广场;公园",
    category: "lawn",
  }),
  true,
  "large riverside park sections should remain eligible"
);

assert.deepStrictEqual(
  groupSearchResults([
    {
      id: "amap-river-1",
      name: "汉口江滩三期",
      address: "武汉市江岸区沿江大道",
      category: "lawn",
      confidence: 60,
      image: "",
    },
    {
      id: "amap-river-2",
      name: "汉口江滩公园",
      address: "武汉市江岸区沿江大道",
      category: "lawn",
      confidence: 58,
      image: "https://example.com/river.jpg",
      imageSource: "amap",
    },
  ]).map((place) => ({
    name: place.name,
    id: place.id,
    image: place.image,
  })),
  [
    {
      name: "汉口江滩",
      id: "amap-river-1",
      image: "https://example.com/river.jpg",
    },
  ],
  "riverfront sections should be grouped into one overall destination while preserving available AMap photos"
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
assert.strictEqual(normalizedPoi.imageSource, "amap");
assert.strictEqual(normalizedPoi.petStatus, "limited");
assert.strictEqual(getStatusLabel(normalizedPoi), "有狗狗肩高/座位限制");

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
assert.strictEqual(normalizedObjectLocationPoi.image, "");
assert.strictEqual(normalizedObjectLocationPoi.imageSource, "none");

assert.strictEqual(
  buildImageSearchQuery({
    name: "汉口江滩",
    address: "武汉市江岸区沿江大道",
  }),
  "汉口江滩 武汉市江岸区沿江大道 实景 图片",
  "image search query should target the specific place instead of a generic web image"
);

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
assert.strictEqual(normalizedHotelPoi.petStatus, "confirmed");
assert.strictEqual(normalizedHotelPoi.petPolicyNote, "可带狗，入住前确认体型、清洁费和房型限制");
assert.strictEqual(
  getStatusLabel(normalizedHotelPoi),
  "可带狗",
  "explicit pet-friendly hotels should not show pending confirmation"
);

assert.strictEqual(
  isRelevantPlaceForCategory(
    {
      name: "武汉亚朵酒店",
      type: "住宿服务;宾馆酒店;宾馆酒店",
      category: "hotel",
    },
    "hotel"
  ),
  false,
  "ordinary chain business hotels should be filtered from pet-friendly hotel results"
);

assert.deepStrictEqual(
  filterPlaces(
    [
      {
        id: "pet-hotel",
        name: "武汉宠物友好酒店",
        type: "住宿服务;宾馆酒店;宾馆酒店",
        category: "hotel",
        lat: 30.593,
        lng: 114.306,
        confidence: 72,
        petStatus: "confirmed",
      },
      {
        id: "homestay",
        name: "东湖可带狗民宿",
        type: "住宿服务;住宿服务相关;住宿服务相关",
        category: "hotel",
        lat: 30.594,
        lng: 114.307,
        confidence: 66,
        petStatus: "limited",
      },
    ],
    wuhanCenter,
    5,
    "hotel"
  ).map((place) => place.id),
  ["pet-hotel", "homestay"],
  "pet-friendly hotels should rank before homestays"
);

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
assert.strictEqual(normalizedPetServicePoi.petStatus, "confirmed");
assert.strictEqual(
  getStatusLabel(normalizedPetServicePoi),
  "可带狗",
  "pet services should not ask users to confirm whether pets are allowed"
);

const normalizedIrrelevantPetKeywordPoi = normalizeAmapPoi(
  {
    id: "B0FFWINE",
    name: "京东酒世界",
    location: "114.306,30.544",
    type: "购物服务;专卖店;烟酒专卖店",
    address: "武汉市武昌区黄鹤楼附近",
    tel: "027-99999999",
    photos: [],
  },
  "宠物服务"
);

assert.notStrictEqual(
  normalizedIrrelevantPetKeywordPoi.category,
  "pet",
  "search keywords alone should not make unrelated POIs pet services"
);

assert.strictEqual(
  isRelevantPlaceForCategory(
    {
      ...normalizedIrrelevantPetKeywordPoi,
      category: "pet",
    },
    "pet"
  ),
  false,
  "irrelevant retail POIs from pet-service searches should be filtered out"
);

assert.deepStrictEqual(
  filterPlaces(
    [
      {
        ...normalizedIrrelevantPetKeywordPoi,
        category: "pet",
        lat: 30.544,
        lng: 114.306,
      },
      {
        ...normalizedPetServicePoi,
        lat: 30.6,
        lng: 114.32,
      },
    ],
    wuhanCenter,
    20,
    "pet"
  ).map((place) => place.id),
  ["amap-B0FFPET"],
  "pet-service filtering should keep real pet services and remove obvious mismatches"
);

const normalizedPetRestaurantPoi = normalizeAmapPoi(
  {
    id: "B0FFDOGCAFE",
    name: "可带狗露台咖啡",
    location: "114.33,30.6",
    type: "餐饮服务;咖啡厅;咖啡厅",
    address: "武汉市江岸区露台路10号",
    tel: "027-55555555",
    photos: [],
  },
  "宠物友好咖啡"
);

assert.strictEqual(normalizedPetRestaurantPoi.petStatus, "limited");
assert.strictEqual(
  normalizedPetRestaurantPoi.petPolicyNote,
  "可带狗，常见限制为牵绳、户外座位或狗狗肩高限制"
);
assert.strictEqual(getStatusLabel(normalizedPetRestaurantPoi), "有狗狗肩高/座位限制");

const normalizedPlainRestaurantPoi = normalizeAmapPoi(
  {
    id: "B0FFPLAINCAFE",
    name: "普通咖啡店",
    location: "114.331,30.601",
    type: "餐饮服务;咖啡厅;咖啡厅",
    address: "武汉市武昌区普通路11号",
    tel: "027-44444444",
    photos: [],
  },
  "咖啡"
);

assert.strictEqual(normalizedPlainRestaurantPoi.category, "restaurant");
assert.strictEqual(normalizedPlainRestaurantPoi.petStatus, "unverified");
assert.strictEqual(
  isRelevantPlaceForCategory(normalizedPlainRestaurantPoi, "restaurant"),
  false,
  "restaurant results should only include places explicitly marked pet-friendly"
);

assert.deepStrictEqual(
  filterPlaces(
    [
      {
        ...normalizedPlainRestaurantPoi,
        lat: 30.601,
        lng: 114.331,
      },
      {
        ...normalizedPetRestaurantPoi,
        lat: 30.6,
        lng: 114.33,
      },
    ],
    wuhanCenter,
    20,
    "restaurant"
  ).map((place) => place.id),
  ["amap-B0FFDOGCAFE"],
  "restaurant filtering should exclude ordinary cafes and keep explicit pet-friendly restaurants"
);

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
