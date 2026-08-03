const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALLOWED_STATUSES = new Set(["allowed", "blocked", "outdoor_only", "uncertain"]);

function makeJsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}

function parseDataUrlImage(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("请上传真实场景照片");

  const mimeType = match[1].toLowerCase();
  const extension = ALLOWED_IMAGE_TYPES[mimeType];
  if (!extension) throw new Error("照片格式仅支持 JPG、PNG 或 WebP");

  const base64 = match[2];
  const bytes = Buffer.byteLength(base64, "base64");
  if (bytes > MAX_PHOTO_BYTES) throw new Error("照片不能超过 3MB");
  if (bytes === 0) throw new Error("照片内容为空");

  return { mimeType, extension, base64, bytes };
}

function sanitizeText(value, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function sanitizeVisitDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return new Date().toISOString().slice(0, 10);
}

function buildFeedbackId(now, idSuffix) {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const suffix =
    idSuffix ||
    Math.random()
      .toString(36)
      .slice(2, 8);
  return `${timestamp}-${suffix}`;
}

function buildFeedbackRecord(payload, options = {}) {
  const placeName = sanitizeText(payload.placeName);
  if (!placeName) throw new Error("缺少地点名称");
  if (!ALLOWED_STATUSES.has(payload.status)) throw new Error("反馈状态无效");

  const now = options.now || new Date();
  const id = buildFeedbackId(now, options.idSuffix);
  const photo = parseDataUrlImage(payload.photoDataUrl);
  const photoPath = `feedback/photos/${id}.${photo.extension}`;

  return {
    id,
    source: "PetsWeb",
    createdAt: now.toISOString(),
    placeId: sanitizeText(payload.placeId, "unknown").slice(0, 120),
    placeName,
    placeAddress: sanitizeText(payload.placeAddress, "暂无地址"),
    category: sanitizeText(payload.category, "unknown").slice(0, 40),
    status: payload.status,
    visitDate: sanitizeVisitDate(payload.visitDate),
    note: sanitizeText(payload.note).slice(0, 300),
    photo: {
      path: photoPath,
      mimeType: photo.mimeType,
      bytes: photo.bytes,
    },
    reviewStatus: "pending",
  };
}

function buildGithubWriteOperations(payload, options = {}) {
  const record = buildFeedbackRecord(payload, options);
  const image = parseDataUrlImage(payload.photoDataUrl);
  const recordContent = JSON.stringify(record, null, 2);

  return [
    {
      path: `feedback/records/${record.id}.json`,
      contentBase64: Buffer.from(recordContent, "utf8").toString("base64"),
    },
    {
      path: record.photo.path,
      contentBase64: image.base64,
    },
  ];
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function putGithubFile({ owner, repo, branch, token, operation }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
    operation.path
  ).replace(/%2F/g, "/")}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      branch,
      message: `Add pet feedback ${operation.path}`,
      content: operation.contentBase64,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `GitHub 写入失败：${operation.path}`);
  }
  return data;
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    makeJsonResponse(res, 204, {});
    return;
  }

  if (req.method !== "POST") {
    makeJsonResponse(res, 405, { error: "只支持 POST 请求" });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || "Syoyo-Ztoto";
  const repo = process.env.GITHUB_REPO || "PetsWeb";
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token) {
    makeJsonResponse(res, 500, { error: "后端缺少 GITHUB_TOKEN 环境变量" });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const operations = buildGithubWriteOperations(payload);
    const writes = [];
    for (const operation of operations) {
      writes.push(await putGithubFile({ owner, repo, branch, token, operation }));
    }

    makeJsonResponse(res, 201, {
      ok: true,
      recordPath: operations[0].path,
      photoPath: operations[1].path,
      commits: writes.map((write) => write.commit?.sha).filter(Boolean),
    });
  } catch (error) {
    makeJsonResponse(res, 400, {
      error: error.message || "反馈提交失败",
    });
  }
}

module.exports = handler;
module.exports.MAX_PHOTO_BYTES = MAX_PHOTO_BYTES;
module.exports.buildFeedbackRecord = buildFeedbackRecord;
module.exports.buildGithubWriteOperations = buildGithubWriteOperations;
module.exports.parseDataUrlImage = parseDataUrlImage;
