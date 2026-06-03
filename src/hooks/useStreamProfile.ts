import { useEffect, useRef, useState } from 'react';
import type { UTCTimestamp } from 'lightweight-charts';

interface VolumeProfileLevels {
  instrumentUid: string;
  timestamp: string;
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  hvn: number[];
  lvn: number[];
  totalVolume: number;
  volumeByPrice: Array<{ price: number; volume: number }>;  // <-- добавьте эту строку
}

function quotationToNumber(q: any): number {
  if (!q) return 0;
  const units = Number(q.units || 0);
  const nano = q.nano || 0;
  return units + nano / 1e9;
}

export function useStreamProfile(
  selectedInstrument: string,
  streamToken: string,
  displayTimeframe: number
) {
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [profile, setProfile] = useState<VolumeProfileLevels | null>(null);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [streamActive, setStreamActive] = useState(false);

  const startStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.startMarketStream || !api?.getTodayCandles) return;

    try {
      // 1. Загружаем исторические свечи за сегодня
      const historical = await api.getTodayCandles(
        selectedInstrument,
        streamToken,
        '1min'
      );
      console.log('[Stream] Исторические свечи загружены:', historical?.length);

      if (historical && historical.length > 0) {
        const formatted = historical.map((c: any) => ({
          time: (Math.floor(new Date(c.time).getTime() / 1000)) as UTCTimestamp,
          open: quotationToNumber(c.open),
          high: quotationToNumber(c.high),
          low: quotationToNumber(c.low),
          close: quotationToNumber(c.close),
        }));
        setCandlesData(formatted);

        // ВАЖНО: передаём историю в движок профиля
        await api.loadHistoricalProfile(selectedInstrument, historical);
      }

      // 2. Запускаем live-стрим
      await api.startMarketStream(streamToken, {
        subscribeCandlesRequest: {
          subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
          instruments: [{
            instrumentId: selectedInstrument,
            interval: 'SUBSCRIPTION_INTERVAL_ONE_MINUTE'
          }]
        }
      });
      setStreamActive(true);
    } catch (err: any) {
      console.error(err);
      alert('Ошибка запуска стрима: ' + err.message);
    }
  };

  const stopStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.stopMarketStream) return;
    await api.stopMarketStream();
    setStreamActive(false);
  };

  // Подписка на live-свечи
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onCandle) return;

    const handleCandle = (streamCandle: any) => {
      let timestampMs: number;
      if (typeof streamCandle.time === 'object' && streamCandle.time.seconds) {
        timestampMs = Number(streamCandle.time.seconds) * 1000 + (streamCandle.time.nanos || 0) / 1e6;
      } else {
        timestampMs = new Date(streamCandle.time).getTime();
      }
      if (isNaN(timestampMs)) return;

      const newCandle = {
        time: Math.floor(timestampMs / 1000) as UTCTimestamp,
        open: quotationToNumber(streamCandle.open),
        high: quotationToNumber(streamCandle.high),
        low: quotationToNumber(streamCandle.low),
        close: quotationToNumber(streamCandle.close),
      };

      setCandlesData(prev => {
        if (prev.some(c => c.time === newCandle.time)) return prev;
        const updated = [...prev, newCandle].sort((a, b) => a.time - b.time);
        console.log('[Stream] Live свеча добавлена, всего свечей:', prev.length + 1);
        return updated.slice(-500);
      });
    };

    api.onCandle(handleCandle);
    return () => { api.removeCandleListener(); };
  }, []);

  // Подписка на профиль и сигналы
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.subscribeTradingAssistant();

    const onProfile = (newProfile: VolumeProfileLevels) => {
      if (newProfile.instrumentUid === selectedInstrument) {
        setProfile(newProfile);
      }
    };
    const onSignal = (signal: any) => {
      if (signal.instrumentUid === selectedInstrument) {
        setLiveSignals(prev => [...prev.slice(-50), signal]);
      }
    };

    api.onProfileUpdate(onProfile);
    api.onTradingSignal(onSignal);

    return () => {
      api.removeProfileUpdateListener();
      api.removeTradingSignalListener();
    };
  }, [selectedInstrument]);

  // Обновление ценового диапазона
  useEffect(() => {
    if (candlesData.length > 0) {
      const prices = candlesData.flatMap(c => [c.high, c.low]);
      setPriceRange({ min: Math.min(...prices), max: Math.max(...prices) });
    }
  }, [candlesData]);

  return {
    candlesData,
    profile,
    priceRange,
    setPriceRange,   // <-- добавить
    liveSignals,
    streamActive,
    startStream,
    stopStream,
  };
}