const assert = require("assert");
const {
  MAX_PHOTO_BYTES,
  buildFeedbackRecord,
  buildGithubWriteOperations,
  parseDataUrlImage,
} = require("../api/feedback");

const validPayload = {
  placeId: "amap-B0FFTEST",
  placeName: "汉口江滩",
  placeAddress: "武汉市江岸区沿江大道",
  category: "lawn",
  status: "allowed",
  visitDate: "2026-08-03",
  note: "牵绳可以进入，现场有人带狗散步。",
  photoDataUrl: `data:image/jpeg;base64,${Buffer.from("fake-image").toString("base64")}`,
};

const parsedImage = parseDataUrlImage(validPayload.photoDataUrl);
assert.strictEqual(parsedImage.mimeType, "image/jpeg");
assert.strictEqual(parsedImage.extension, "jpg");
assert.strictEqual(parsedImage.base64, Buffer.from("fake-image").toString("base64"));

const record = buildFeedbackRecord(validPayload, {
  now: new Date("2026-08-03T10:20:30.000Z"),
  idSuffix: "abc123",
});

assert.strictEqual(record.id, "2026-08-03T10-20-30-000Z-abc123");
assert.strictEqual(record.placeName, "汉口江滩");
assert.strictEqual(record.status, "allowed");
assert.strictEqual(record.photo.mimeType, "image/jpeg");
assert.strictEqual(record.photo.path, "feedback/photos/2026-08-03T10-20-30-000Z-abc123.jpg");

const operations = buildGithubWriteOperations(validPayload, {
  now: new Date("2026-08-03T10:20:30.000Z"),
  idSuffix: "abc123",
});

assert.deepStrictEqual(
  operations.map((operation) => operation.path),
  [
    "feedback/records/2026-08-03T10-20-30-000Z-abc123.json",
    "feedback/photos/2026-08-03T10-20-30-000Z-abc123.jpg",
  ],
  "feedback should be persisted as one JSON record and one photo file"
);

assert.strictEqual(
  JSON.parse(Buffer.from(operations[0].contentBase64, "base64").toString("utf8")).photo.path,
  "feedback/photos/2026-08-03T10-20-30-000Z-abc123.jpg"
);
assert.strictEqual(operations[1].contentBase64, parsedImage.base64);

assert.throws(
  () =>
    buildFeedbackRecord({
      ...validPayload,
      status: "maybe",
    }),
  /反馈状态无效/,
  "unknown feedback statuses should be rejected"
);

assert.throws(
  () =>
    parseDataUrlImage(
      `data:image/svg+xml;base64,${Buffer.from("<svg></svg>").toString("base64")}`
    ),
  /照片格式仅支持/,
  "svg uploads should be rejected"
);

assert.throws(
  () =>
    parseDataUrlImage(
      `data:image/jpeg;base64,${Buffer.alloc(MAX_PHOTO_BYTES + 1).toString("base64")}`
    ),
  /照片不能超过/,
  "oversized photos should be rejected"
);

console.log("feedback tests passed");
