"use client";

import { useCallback, useEffect, useState } from "react";
import { RollingYoYChart } from "@/components/rolling-yoy-chart";
import type { NasdaqYoYResponse } from "@/lib/types";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatPercent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatPoints(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function LoadingState() {
  return (
    <main className="page-shell" aria-busy="true" aria-label="正在加载纳斯达克数据">
      <div className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <span>MARKET LENS</span>
      </div>
      <section className="dashboard-card loading-card">
        <div className="skeleton skeleton-kicker" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-value" />
        <div className="skeleton skeleton-chart" />
      </section>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="page-shell">
      <div className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <span>MARKET LENS</span>
      </div>
      <section className="dashboard-card error-card" role="alert">
        <span className="error-icon" aria-hidden="true">!</span>
        <p className="eyebrow">数据连接中断</p>
        <h1>暂时无法载入指数数据</h1>
        <p>{message}</p>
        <button type="button" onClick={onRetry}>重新加载</button>
      </section>
    </main>
  );
}

export function NasdaqDashboard() {
  const [data, setData] = useState<NasdaqYoYResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);

      try {
        const response = await fetch("/api/nasdaq", { signal: controller.signal });
        const payload = (await response.json()) as NasdaqYoYResponse | { error?: string };

        if (!response.ok || !("points" in payload)) {
          throw new Error("error" in payload && payload.error ? payload.error : "未知数据错误");
        }

        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "未知数据错误");
      }
    }

    void loadData();
    return () => controller.abort();
  }, [requestVersion]);

  const retry = useCallback(() => {
    setData(null);
    setRequestVersion((version) => version + 1);
  }, []);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <LoadingState />;

  const direction = data.stats.latestYoyPct >= 0 ? "positive" : "negative";

  return (
    <main className="page-shell">
      <header className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <span>MARKET LENS</span>
        <span className="brand-separator" aria-hidden="true" />
        <span className="brand-edition">INDEX SERIES</span>
      </header>

      <article className="dashboard-card">
        <header className="instrument-header">
          <div>
            <p className="eyebrow">美国市场 · 滚动一年同比</p>
            <h1>{data.name}</h1>
            <div className="symbol-line">
              <span>INDEXNASDAQ: {data.symbol}</span>
              <span className="live-dot" aria-hidden="true" />
              <span>{data.frequency}</span>
            </div>
          </div>
          <span className="range-chip">ROLLING 1Y</span>
        </header>

        <section className="hero-metric" aria-label="最新滚动一年同比表现">
          <p className={`hero-percent ${direction}`}>
            {formatPercent(data.stats.latestYoyPct)}
          </p>
          <div className={`change-badge ${direction}`}>
            <span aria-hidden="true">{direction === "positive" ? "↗" : "↘"}</span>
            <span>{formatPoints(data.stats.latestChangePoints)} 点</span>
            <span className="change-context">同比</span>
          </div>
          <p className="comparison-copy">
            最新收盘 <strong>{numberFormatter.format(data.stats.latestClose)}</strong>
            <span aria-hidden="true"> · </span>
            对比 {formatDate(data.stats.comparisonDate)} 的 {numberFormatter.format(data.stats.comparisonClose)}
          </p>
        </section>

        <section className="chart-panel" aria-labelledby="chart-title">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">过去 12 个月的每日同比变化</p>
              <h2 id="chart-title">滚动一年涨跌幅趋势</h2>
            </div>
            <div className="legend" role="list">
              <span role="listitem"><i className="legend-swatch positive-bg" />同比为正</span>
              <span role="listitem"><i className="legend-swatch negative-bg" />同比为负</span>
            </div>
          </div>
          <RollingYoYChart points={data.points} />
        </section>

        <section className="stats-grid" aria-label="趋势摘要">
          <div className="stat-card">
            <span>区间同比高点</span>
            <strong className={data.stats.highYoyPct >= 0 ? "positive" : "negative"}>
              {formatPercent(data.stats.highYoyPct)}
            </strong>
          </div>
          <div className="stat-card">
            <span>区间同比低点</span>
            <strong className={data.stats.lowYoyPct >= 0 ? "positive" : "negative"}>
              {formatPercent(data.stats.lowYoyPct)}
            </strong>
          </div>
          <div className="stat-card">
            <span>同比为正交易日</span>
            <strong>{data.stats.positiveDayShare.toFixed(1)}%</strong>
          </div>
          <div className="stat-card">
            <span>最新指数点位</span>
            <strong>{numberFormatter.format(data.stats.latestClose)}</strong>
          </div>
        </section>

        <footer className="data-footer">
          <div>
            <p><strong>计算口径</strong> {data.methodology}</p>
            <p>数据截至 {formatDate(data.asOf)}。本图使用日收盘数据，不代表盘中实时行情，也不构成投资建议。</p>
          </div>
          <a href={data.source.url} target="_blank" rel="noreferrer">
            数据来源：{data.source.name}
            <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </article>
    </main>
  );
}
