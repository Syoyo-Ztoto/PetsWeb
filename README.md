# 武汉宠物友好地图网页

这是一个静态网页版本，已经接入高德 JS API，用于验证“输入武汉地址 + 半径筛选 + 宠物友好地点推荐”的核心体验。

## 如何打开

双击 `index.html`，或访问已部署的 GitHub Pages 页面。

## 当前实现

- 城市固定为武汉。
- 支持输入任意武汉地址，由高德地理编码解析为经纬度。
- 支持 1 / 3 / 5 / 10 / 20 公里半径筛选。
- 支持先选择草坪/江滩、公园/绿道、商场/商圈、餐饮/咖啡、酒店/住宿、宠物服务，再点击搜索。
- 使用高德 JS API 展示真实地图。
- 使用高德 PlaceSearch 周边搜索返回真实 POI。
- 搜索结果图片优先使用高德 POI `photos` 字段。
- 高德没有图片时，不再使用随机网图；页面优先生成高德静态地图截图作为兜底，并可点击打开线上图片搜索页。
- 草坪/江滩、公园/绿道类结果会过滤停车场、学校、幼儿园、地铁站、厕所、入口、出口等非散步遛狗休闲区域。
- 还会过滤加油站、办事处、政务机构、亲子馆、健康调理馆、培训机构、营业厅、公司、写字楼、住宅小区、仓库物流等强业务指向场景。
- 草坪/江滩搜索词已收紧为“江滩公园、草坪公园、滨江公园”，避免“滨江某某店”这类无关地点被召回。
- 江滩、公园、绿道、湿地等分段结果会合并为一个总体地点，例如“汉口江滩三期”和“汉口江滩公园”合并显示为“汉口江滩”。
- 酒店结果优先显示明确“宠物友好/可带狗/可携宠”的酒店，其次显示可带狗民宿或携宠民宿。
- 酒店类会过滤明显普通商务/星级连锁酒店，例如亚朵、全季、汉庭、如家、维也纳、希尔顿、万豪等未标明宠物友好的结果。
- 宠物服务、宠物友好餐厅/咖啡、宠物友好酒店等明确可带宠场景不再显示“待确认”；会显示“可带狗”或“有狗狗肩高/座位限制”等更具体说明。
- 使用高德 Walking 路线规划计算推荐地点到用户搜索位置的真实步行路线距离。
- 使用高德 Driving 路线规划计算当下驾车预估时间。
- 列表和详情优先显示“路线距离 · 驾车约 X 分钟”；路线接口失败或超时时才显示“直线距离”。
- 导航按钮优先使用高德经纬度作为终点，并在终点展示名中补充“武汉”前缀，避免跨城市同名街道、酒店或地点被误导到外省。
- 如果某条结果缺少经纬度，导航会降级为带 `武汉` 城市上下文的高德搜索。
- 页面加载和切换类别时不会自动搜索；只有点击搜索时才请求高德，以减少接口数量和等待时间。
- 同一地址坐标、半径和类别的重复搜索会复用浏览器内存缓存。
- 合并本地审核示例数据，优先展示更高可信度记录。
- 展示地点图片、距离、可信度、宠物友好状态、依据、电话和高德导航链接。

## 高德配置

配置文件在 `src/amapConfig.js`。

静态 GitHub Pages 无法隐藏前端 JS API Key 和安全密钥。请在高德控制台为 Key 配置域名白名单，至少包含：

- `https://syoyo-ztoto.github.io`
- `https://syoyo-ztoto.github.io/PetsWeb/`
- 本地调试时可临时加入 `http://localhost` 或直接打开文件对应的调试来源

不要把高德 Web 服务 Key 用在纯前端请求里。Web 服务 Key 应放在后端，由后端代理地理编码、POI 搜索、缓存和风控。

## 前后端拆分

当前仓库已经按“静态前端 + 可选后端接口”拆开：

- 前端：`index.html`、`styles.css`、`src/*`，继续部署到 GitHub Pages。
- 后端：`api/search.js`，部署到 Vercel、Netlify Functions、Cloudflare Workers 或自己的 Node 服务。
- 测试：`tests/*`，用于校验筛选、排序、导航和后端返回结构。

GitHub Pages 只能托管静态网页，不能运行 `api/search.js`。因此真实 Web 服务 Key 不应写进 GitHub Pages 前端文件里，而是配置到后端运行环境变量：

```text
AMAP_WEB_SERVICE_KEY=你的高德 Web 服务 Key
```

后端部署完成后，把 `src/backendConfig.js` 里的 `searchEndpoint` 改成后端接口地址，例如：

```js
window.PETS_BACKEND_CONFIG = {
  searchEndpoint: "https://your-vercel-app.vercel.app/api/search",
};
```

配置了 `searchEndpoint` 后，网页搜索会优先请求后端。后端不可用或未配置时，网页会自动回退到当前的高德 JS API 前端搜索。

### 后端接口职责

`api/search.js` 负责：

- 隐藏高德 Web 服务 Key。
- 将用户输入地址限定在武汉范围内地理编码。
- 按用户选择的类别和半径请求高德 Web 服务 POI。
- 复用 `src/placeLogic.js` 的筛选、去重、酒店优先级、宠物友好状态判断。
- 请求高德步行/驾车路线，返回路线距离和当下驾车预估时间。
- 对同一地址、半径、类别做 10 分钟内存缓存，减少重复请求。

当前前端使用的是高德 JS API：

- `AMap.Map`：真实地图底图
- `AMap.Geocoder`：把用户输入的武汉地址解析为经纬度
- `AMap.PlaceSearch.searchNearBy`：按用户选择半径搜索附近 POI
- `AMap.Walking`：计算用户搜索地点到推荐地点的真实步行路线距离
- `AMap.Driving`：计算用户搜索地点到推荐地点的当下驾车预估时间
- `AMap.Marker`：在地图上标记出发点和候选地点
- `src/imageResolver.js`：高德无图时生成线上图片搜索截图地址

如果部署页加载失败，优先检查浏览器控制台里的高德错误码，以及高德控制台里的服务平台、Key 限制和域名白名单。

## 后续真实数据增强

1. 部署 `api/search.js`，把 `src/backendConfig.js` 指向后端接口。
2. 建立数据库表：地点、宠物友好状态、证据记录、用户反馈、运营审核任务。
3. 将 10 分钟内存缓存升级为数据库缓存或 Redis 缓存。
4. 小红书/抖音内容不要直接抓取；优先走官方合作、人工录入摘要和用户授权反馈。

## 本地校验

使用 Codex 自带 Node.js 运行：

```powershell
& 'C:\Users\74731\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\placeLogic.test.js
& 'C:\Users\74731\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\backendSearch.test.js
```
