// src/components/TRADING_ASSISTANT/AmChartsStockChart/AmChartsStockChart.tsx
import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5stock from '@amcharts/amcharts5/stock';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import am5themes_Dark from '@amcharts/amcharts5/themes/Dark';

/* === Типы === */
interface CandlestickData { time: number; open: number; high: number; low: number; close: number; }
interface SignalData { time: string; type: string; price: number; reason: string; }
interface TradeData { entryTime: string; exitTime: string; entryPrice: number; exitPrice: number; type: string; exitReason: string; }
interface AmChartsStockChartProps {
  candlesData: CandlestickData[];
  volumeByPrice?: Array<{ price: number; volume: number }>;
  poc?: number; vah?: number; val?: number;
  signals?: SignalData[];
  trades?: TradeData[];
  positions?: any[];
}

const candleUpColor   = 0x26a69a;
const candleDownColor = 0xef5350;
const volumeProfileColor = 0x808080;

export const AmChartsStockChart: React.FC<AmChartsStockChartProps> = ({
  candlesData,
  volumeByPrice,
  poc, vah, val,
  signals = [],
  trades = [],
  positions = [],
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const mainPanelRef = useRef<am5stock.StockPanel | null>(null);
  const dateAxisRef = useRef<am5xy.DateAxis<any> | null>(null);
  const valueAxisRef = useRef<am5xy.ValueAxis<any> | null>(null);

  // Основной график (свечи + профиль + линии)
  useLayoutEffect(() => {
    if (!chartRef.current || candlesData.length === 0) return;

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    root.setThemes([
      am5themes_Animated.new(root),
      am5themes_Dark.new(root),
    ]);

    const stockChart = root.container.children.push(
      am5stock.StockChart.new(root, {
        paddingRight: 0,
        stockPositiveColor: am5.color(candleUpColor),
        stockNegativeColor: am5.color(candleDownColor),
        volumePositiveColor: am5.color(candleUpColor),
        volumeNegativeColor: am5.color(candleDownColor),
      })
    );

    const mainPanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        wheelY: 'zoomX',
        panX: true,
        panY: true,
        height: am5.percent(70),
      })
    );
    mainPanelRef.current = mainPanel;

    const valueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { pan: 'zoom' }),
        numberFormat: '#,###.00',
        extraTooltipPrecision: 2,
      })
    );
    valueAxisRef.current = valueAxis;

    const dateAxis = mainPanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: { timeUnit: 'minute', count: 1 },
        groupData: false,
        renderer: am5xy.AxisRendererX.new(root, { minorGridEnabled: true }),
      })
    );
    dateAxisRef.current = dateAxis;

    // Свечи
    const valueSeries = mainPanel.series.push(
      am5xy.CandlestickSeries.new(root, {
        name: 'Price',
        valueXField: 'Date',
        valueYField: 'Close',
        highValueYField: 'High',
        lowValueYField: 'Low',
        openValueYField: 'Open',
        calculateAggregates: true,
        xAxis: dateAxis,
        yAxis: valueAxis,
      })
    );
    valueSeries.columns.template.setAll({ strokeWidth: 2 });
    stockChart.set('stockSeries', valueSeries);

    // Скрытый объём (нужен для VolumeProfile)
    const volumeAxisRenderer = am5xy.AxisRendererY.new(root, { inside: true });
    volumeAxisRenderer.labels.template.set('forceHidden', true);
    volumeAxisRenderer.grid.template.set('forceHidden', true);

    const volumeValueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        numberFormat: '#.#a',
        height: am5.percent(0),
        y: am5.percent(100),
        centerY: am5.percent(100),
        renderer: volumeAxisRenderer,
        visible: false,
      })
    );

    const volumeSeries = mainPanel.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Volume',
        valueXField: 'Date',
        valueYField: 'Volume',
        xAxis: dateAxis,
        yAxis: volumeValueAxis,
        visible: false,
      })
    );
    stockChart.set('volumeSeries', volumeSeries);

    // Volume Profile
    const volumeProfile = stockChart.indicators.push(
      am5stock.VolumeProfile.new(root, {
        stockChart: stockChart,
        stockSeries: valueSeries,
        volumeSeries: volumeSeries,
      })
    );

    (volumeProfile as any).setAll({
      draggable: true,
      upColor: am5.color(volumeProfileColor),
      downColor: am5.color(volumeProfileColor),
      pocLineColor: am5.color(0x000000),
      pocLineAlpha: 0,
      valueAreaHighLineColor: am5.color(0x000000),
      valueAreaHighLineAlpha: 0,
      valueAreaLowLineColor: am5.color(0x000000),
      valueAreaLowLineAlpha: 0,
    });

    // Линии уровней
    const addLevelLine = (value: number | undefined, color: number, dash: number[] = []) => {
      if (value === undefined) return;
      const range = valueAxis.createAxisRange(valueAxis.makeDataItem({ value }));
      range.get('grid')?.setAll({
        stroke: am5.color(color),
        strokeOpacity: 0.8,
        strokeDasharray: dash,
        visible: true,
      });
      range.get('label')?.setAll({
        text: `${value.toFixed(2)}`,
        fill: am5.color(color),
        fontSize: 11,
        fontWeight: 'bold',
        visible: true,
      });
    };

    addLevelLine(poc, 0xff0000);
    addLevelLine(vah, 0x00ff00, [4, 4]);
    addLevelLine(val, 0x00ff00, [4, 4]);

    // Данные
    const am5Data = candlesData.map(c => ({
      Date: c.time * 1000,
      Open: c.open,
      High: c.high,
      Low: c.low,
      Close: c.close,
      Volume: 1,
    }));
    valueSeries.data.setAll(am5Data);
    volumeSeries.data.setAll(am5Data);

    mainPanel.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        yAxis: valueAxis,
        xAxis: dateAxis,
        snapToSeries: [valueSeries],
        snapToSeriesBy: 'y!',
      })
    );

    return () => {
      root.dispose();
      rootRef.current = null;
    };
  }, [candlesData, volumeByPrice, poc, vah, val]);

  // Маркеры (отдельный эффект, чтобы не пересоздавать график)
  useLayoutEffect(() => {
    const root = rootRef.current;
    const mainPanel = mainPanelRef.current;
    const dateAxis = dateAxisRef.current;
    const valueAxis = valueAxisRef.current;
    if (!root || !mainPanel || !dateAxis || !valueAxis) return;

    // Удаляем старые серии маркеров
    (mainPanel as any)._signalSeries?.dispose();
    (mainPanel as any)._tradeSeries?.dispose();
    (mainPanel as any)._positionSeries?.dispose();

    // Логи для отладки
    console.log('[AmCharts] Signals:', signals.length, 'Trades:', trades.length, 'Positions:', positions.length);

    // Сигналы
    if (signals.length > 0) {
      const signalSeries = mainPanel.series.push(
        am5xy.LineSeries.new(root, {
          xAxis: dateAxis,
          yAxis: valueAxis,
          valueXField: 'Date',
          valueYField: 'Price',
        })
      );
      (signalSeries as any).strokes.template.setAll({ strokeOpacity: 0 });
      (signalSeries as any).fills.template.setAll({ fillOpacity: 0 });

      signalSeries.data.setAll(
        signals.map(s => ({
          Date: new Date(s.time).getTime(),
          Price: s.price,
        }))
      );

      // Настройка маркеров: крупные и контрастные
      (signalSeries as any).pointMarkers.template.setAll({
        fill: am5.color(0x00ff00),      // ярко-зелёный
        stroke: am5.color(0xffffff),     // белая обводка
        strokeWidth: 2,
        width: 12,
        height: 12,
        visible: true,
      });

      (mainPanel as any)._signalSeries = signalSeries;
    }

    // Сделки
    if (trades.length > 0) {
      const tradeSeries = mainPanel.series.push(
        am5xy.LineSeries.new(root, {
          xAxis: dateAxis,
          yAxis: valueAxis,
          valueXField: 'Date',
          valueYField: 'Price',
        })
      );
      (tradeSeries as any).strokes.template.setAll({ strokeOpacity: 0 });
      (tradeSeries as any).fills.template.setAll({ fillOpacity: 0 });

      tradeSeries.data.setAll(
        trades.map(t => ({
          Date: new Date(t.exitTime).getTime(),
          Price: t.exitPrice,
        }))
      );

      (tradeSeries as any).pointMarkers.template.setAll({
        fill: am5.color(0xff0000),      // ярко-красный
        stroke: am5.color(0xffffff),
        strokeWidth: 2,
        width: 12,
        height: 12,
        visible: true,
      });

      (mainPanel as any)._tradeSeries = tradeSeries;
    }

    // Позиции
    if (positions.length > 0) {
      const positionSeries = mainPanel.series.push(
        am5xy.LineSeries.new(root, {
          xAxis: dateAxis,
          yAxis: valueAxis,
          valueXField: 'Date',
          valueYField: 'Price',
        })
      );
      (positionSeries as any).strokes.template.setAll({ strokeOpacity: 0 });
      (positionSeries as any).fills.template.setAll({ fillOpacity: 0 });

      positionSeries.data.setAll(
        positions.map(p => ({
          Date: Date.now(),
          Price: p.averagePositionPrice?.units
            ? Number(p.averagePositionPrice.units) + Number(p.averagePositionPrice.nano) / 1e9
            : 0,
        }))
      );

      (positionSeries as any).pointMarkers.template.setAll({
        fill: am5.color(0xffff00),      // ярко-жёлтый
        stroke: am5.color(0x000000),
        strokeWidth: 2,
        width: 15,
        height: 15,
        visible: true,
      });

      (mainPanel as any)._positionSeries = positionSeries;
    }
  }, [signals, trades, positions]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px', flex: 1 }} />;
};