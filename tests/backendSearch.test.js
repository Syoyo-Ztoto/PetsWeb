const assert = require("assert");
const {
  buildSearchResponse,
  getCategoryKeywords,
  parseSearchParams,
} = require("../api/search");

assert.deepStrictEqual(
  getCategoryKeywords("hotel"),
  ["宠物友好酒店", "可带狗民宿", "携宠民宿"],
  "hotel backend search should focus on pet-friendly hotels and homestays"
);

assert.deepStrictEqual(
  getCategoryKeywords("restaurant"),
  ["宠物友好咖啡", "可带狗餐厅", "宠物友好餐厅", "可携宠咖啡"],
  "restaurant backend search should avoid broad generic cafe searches"
);

assert.deepStrictEqual(
  parseSearchParams({
    address: "武汉天地",
    radius: "50",
    category: "hotel",
  }),
  {
    address: "武汉天地",
    radiusKm: 20,
    category: "hotel",
  },
  "backend search params should clamp radius to 20 km"
);

assert.deepStrictEqual(
  parseSearchParams({
    address: "天地",
    radius: "3",
    category: "unknown",
  }),
  {
    address: "天地",
    radiusKm: 3,
    category: "lawn",
  },
  "backend search params should default unknown categories to lawn"
);

const response = buildSearchResponse({
  origin: { lat: 30.5928, lng: 114.3055, label: "武汉天地附近" },
  radiusKm: 20,
  category: "hotel",
  rawPois: [
    {
      id: "CHAIN",
      name: "武汉亚朵酒店",
      location: "114.31,30.6",
      type: "住宿服务;宾馆酒店;宾馆酒店",
      address: "武汉市江岸区示例路1号",
      tel: "027-11111111",
      photos: [],
      __keyword: "酒店",
    },
    {
      id: "PET-HOTEL",
      name: "武汉宠物友好酒店",
      location: "114.32,30.6",
      type: "住宿服务;宾馆酒店;宾馆酒店",
      address: "武汉市江岸区示例路2号",
      tel: "027-22222222",
      photos: [{ url: "https://example.com/hotel.jpg" }],
      __keyword: "宠物友好酒店",
    },
    {
      id: "HOMESTAY",
      name: "东湖可带狗民宿",
      location: "114.33,30.6",
      type: "住宿服务;住宿服务相关;住宿服务相关",
      address: "武汉市武昌区示例路3号",
      tel: "027-33333333",
      photos: [],
      __keyword: "可带狗民宿",
    },
  ],
});

assert.strictEqual(response.source, "backend-amap");
assert.strictEqual(response.city, "武汉");
assert.deepStrictEqual(
  response.places.map((place) => place.name),
  ["武汉宠物友好酒店", "东湖可带狗民宿"],
  "backend response should filter ordinary chain hotels and rank explicit pet-friendly hotels first"
);
assert.strictEqual(response.places[0].petStatus, "confirmed");
assert.strictEqual(response.places[0].imageSource, "amap");

console.log("backend search tests passed");
