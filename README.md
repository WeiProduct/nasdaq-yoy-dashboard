# NASDAQ Rolling 1Y

一个以方案 B 实现的纳斯达克综合指数滚动一年同比趋势网页。图中每个交易日都与一年前同日（若休市，则使用此前最近交易日）的收盘点位比较。

## 在线访问

- GitHub Pages（易记）：[https://weiproduct.github.io/nasdaq-yoy-dashboard/](https://weiproduct.github.io/nasdaq-yoy-dashboard/)
- Vercel：[https://nasdaq-yoy-dashboard.vercel.app](https://nasdaq-yoy-dashboard.vercel.app)
- 源代码：[https://github.com/WeiProduct/nasdaq-yoy-dashboard](https://github.com/WeiProduct/nasdaq-yoy-dashboard)

## 功能

- FRED `NASDAQCOM` 历史日收盘数据，由 Next.js 服务端代理并缓存。
- 当日点位来自 Nasdaq 官方公开指数行情，服务端与网页均每 10 分钟刷新；公开展示数据至少延迟 1 分钟。
- 上游超时保护与内置数据快照容灾，避免云端数据源故障导致空白页。
- 最近 12 个月逐日滚动同比百分比趋势。
- 可选“对比年初至今”折线，以上一年最后一个交易日收盘为 0% 基准。
- 正负区间双色折线与面积填充、0% 基准线。
- 鼠标、触摸和键盘方向键均可查看每日同比、年初至今、当前收盘价和去年对比价。
- GitHub Pages 每天在美股收盘后重新构建；页面和 Vercel 数据端点每 10 分钟重新验证当日数据。
- 加载、错误、响应式和无障碍状态。
- 单元测试覆盖 CSV 清洗、闰年和非交易日比较规则。

## 本地运行

```bash
npm install
npm run dev
```

然后访问 [http://localhost:3000](http://localhost:3000)。

## 验证

```bash
npm run check
```

## 数据口径

`同比涨跌幅 = (当日收盘点位 / 一年前同日或此前最近交易日收盘点位 - 1) × 100%`

`年初至今涨跌幅 = (当日点位 / 上一年最后一个交易日收盘点位 - 1) × 100%`

数据来自 [FRED NASDAQCOM](https://fred.stlouisfed.org/series/NASDAQCOM)，为日收盘数据，不是盘中实时行情。
