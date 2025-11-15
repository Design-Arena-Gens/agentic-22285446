"use client";

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, UTCTimestamp, CandlestickSeriesOptions, CandlestickData } from 'lightweight-charts';
import type { Candle } from '../app/page';

export default function CandleChart({ candles, symbol, interval }: { candles: Candle[]; symbol: string; interval: string; }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi['addCandlestickSeries']> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 520,
      layout: { background: { color: '#ffffff' }, textColor: '#222' },
      grid: { horzLines: { color: '#eee' }, vertLines: { color: '#f5f5f5' } },
      timeScale: { borderColor: '#eee' },
      rightPriceScale: { borderColor: '#eee' },
      crosshair: { mode: 1 },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#16a34a', downColor: '#dc2626', borderDownColor: '#dc2626', borderUpColor: '#16a34a', wickDownColor: '#dc2626', wickUpColor: '#16a34a',
    } as CandlestickSeriesOptions);

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data: CandlestickData[] = candles.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>{symbol}</strong>
        <span>{interval}</span>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
