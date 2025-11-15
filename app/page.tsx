"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';
import { fetchSeedKlines, openKlineStream, BinanceInterval, defaultSymbols } from '../lib/binance';
import { analyzePatterns } from '../lib/patterns';
import { computeRsi } from '../lib/indicators';
import dynamic from 'next/dynamic';

const CandleChart = dynamic(() => import('../components/CandleChart'), { ssr: false });

export type Candle = {
  time: number; // seconds since epoch for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Signal = {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0..100
  reasons: string[];
};

export default function HomePage() {
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [interval, setInterval] = useState<BinanceInterval>('1m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [signal, setSignal] = useState<Signal>({ action: 'HOLD', confidence: 0, reasons: [] });
  const socketRef = useRef<WebSocket | null>(null);

  // Load initial klines and open stream
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const seed = await fetchSeedKlines(symbol, interval, 500);
      if (cancelled) return;
      setCandles(seed);

      // Close previous socket
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
      }

      const ws = openKlineStream(symbol, interval, (k) => {
        setLastPrice(k.close);
        setCandles((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (!last || k.time > last.time) {
            copy.push(k);
          } else {
            copy[copy.length - 1] = k;
          }
          return copy.slice(-1000);
        });
      });
      socketRef.current = ws;
    }

    load();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
        socketRef.current = null;
      }
    };
  }, [symbol, interval]);

  // Recompute patterns and signal on candle change
  useEffect(() => {
    if (candles.length < 20) return;
    const found = analyzePatterns(candles);
    const rsi = computeRsi(candles.map(c => c.close), 14);
    const latestRsi = rsi[rsi.length - 1] ?? 50;

    const bullish = found.filter(f => f.startsWith('Bullish')).length;
    const bearish = found.filter(f => f.startsWith('Bearish')).length;

    let action: Signal['action'] = 'HOLD';
    const reasons: string[] = [];
    let confidence = 0;

    if (bullish > bearish && latestRsi < 70) {
      action = 'BUY';
      confidence = Math.min(90, 50 + bullish * 10 - bearish * 5 + Math.max(0, 70 - latestRsi) * 0.3);
      reasons.push('Bullish candlestick patterns');
      reasons.push(`RSI ${latestRsi.toFixed(1)} (< 70)`);
    } else if (bearish > bullish && latestRsi > 30) {
      action = 'SELL';
      confidence = Math.min(90, 50 + bearish * 10 - bullish * 5 + Math.max(0, latestRsi - 30) * 0.3);
      reasons.push('Bearish candlestick patterns');
      reasons.push(`RSI ${latestRsi.toFixed(1)} (> 30)`);
    } else {
      action = 'HOLD';
      confidence = 40;
      reasons.push('Mixed signals or neutral RSI');
    }

    setPatterns(found.slice(-8));
    setSignal({ action, confidence: Math.round(confidence), reasons });
  }, [candles]);

  const intervals: BinanceInterval[] = ['1m', '5m', '15m', '1h', '4h'];

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1>Crypto Live Dashboard</h1>
        <div className={styles.controls}>
          <div className={styles.group}>
            <label>Symbol</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          </div>
          <div className={styles.group}>
            <label>Interval</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value as BinanceInterval)}>
              {intervals.map((iv) => (
                <option key={iv} value={iv}>{iv}</option>
              ))}
            </select>
          </div>
          <div className={styles.group}>
            <label>Quick Symbols</label>
            <div className={styles.quickRow}>
              {defaultSymbols.map((s) => (
                <button key={s} className={s === symbol ? styles.active : ''} onClick={() => setSymbol(s)}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className={styles.mainGrid}>
        <div className={styles.chartCard}>
          <CandleChart candles={candles} symbol={symbol} interval={interval} key={`${symbol}-${interval}`} />
        </div>
        <aside className={styles.sideCard}>
          <h3>Live</h3>
          <div className={styles.liveRow}>
            <span>Symbol</span>
            <strong>{symbol}</strong>
          </div>
          <div className={styles.liveRow}>
            <span>Price</span>
            <strong>{lastPrice ? lastPrice.toLocaleString() : '?'}</strong>
          </div>

          <h3>Signals</h3>
          <div className={styles.signalBlock} data-action={signal.action}>
            <div className={styles.signalHeader}>
              <span>Action</span>
              <strong>{signal.action}</strong>
            </div>
            <div className={styles.signalHeader}>
              <span>Confidence</span>
              <strong>{signal.confidence}%</strong>
            </div>
            <ul className={styles.reasons}>
              {signal.reasons.map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
          </div>

          <h3>Recent Patterns</h3>
          <ul className={styles.patternList}>
            {patterns.length === 0 && <li>No strong patterns yet</li>}
            {patterns.map((p, i) => (<li key={i}>{p}</li>))}
          </ul>
        </aside>
      </section>
      <footer className={styles.footer}>
        <span>Data from Binance. Not financial advice.</span>
      </footer>
    </main>
  );
}
