// src/components/TRADING_ASSISTANT/AmChartsStockChart/AmChartsStockChart.tsx
import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5stock from '@amcharts/amcharts5/stock';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import am5themes_Dark from '@amcharts/amcharts5/themes/Dark';

interface AmChartsStockChartProps {
  candlesData: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
  volumeByPrice?: Array<{ price: number; volume: number }>;
  poc?: number;
  vah?: number;
  val?: number;
}

const colorPositive = 0x767D84;
const colorNegative = 0x5B636A;

export const AmChartsStockChart: React.FC<AmChartsStockChartProps> = ({
  candlesData,
  volumeByPrice,
  poc,
  vah,
  val,
}) => {
  const chartDivRef = useRef<HTMLDivElement>(null);
  const stockChartRef = useRef<am5stock.StockChart | null>(null);

  useLayoutEffect(() => {
    if (!chartDivRef.current || candlesData.length === 0) return;

    // Создаём корневой элемент amCharts
    const root = am5.Root.new(chartDivRef.current);

    root.setThemes([
      am5themes_Animated.new(root),
      am5themes_Dark.new(root),
    ]);

    const stockChart = root.container.children.push(
      am5stock.StockChart.new(root, {
        paddingRight: 0,
        stockPositiveColor: am5.color(0x009999),
        stockNegativeColor: am5.color(0x006666),
        volumePositiveColor: am5.color(colorPositive),
        volumeNegativeColor: am5.color(colorNegative),
      })
    );

    // Основная панель графика
    const mainPanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        wheelY: 'zoomX',
        panX: true,
        panY: true,
        height: am5.percent(70),
      })
    );

    // Ось Y (цена)
    const valueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { pan: 'zoom' }),
        numberFormat: '#,###.00',
        extraTooltipPrecision: 2,
      })
    );

    // Ось X (время)
    const dateAxis = mainPanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: { timeUnit: 'minute', count: 1 },
        groupData: true,
        renderer: am5xy.AxisRendererX.new(root, {
          minorGridEnabled: true,
        }),
      })
    );

    // Свечная серия
    const valueSeries = mainPanel.series.push(
      am5xy.CandlestickSeries.new(root, {
        name: 'Price',
        clustered: false,
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

    // Объёмная серия
    const volumeAxisRenderer = am5xy.AxisRendererY.new(root, { inside: true });
    volumeAxisRenderer.labels.template.set('forceHidden', true);
    volumeAxisRenderer.grid.template.set('forceHidden', true);

    const volumeValueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        numberFormat: '#.#a',
        height: am5.percent(20),
        y: am5.percent(100),
        centerY: am5.percent(100),
        renderer: volumeAxisRenderer,
      })
    );

    const volumeSeries = mainPanel.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Volume',
        clustered: false,
        valueXField: 'Date',
        valueYField: 'Volume',
        xAxis: dateAxis,
        yAxis: volumeValueAxis,
      })
    );

    volumeSeries.columns.template.setAll({
      strokeOpacity: 0,
      fillOpacity: 0.5,
    });

    volumeSeries.columns.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem) {
        return stockChart.getVolumeColor(dataItem);
      }
      return fill;
    });

    stockChart.set('volumeSeries', volumeSeries);

    // Добавляем Volume Profile (встроенный индикатор amCharts)
    const volumeProfile = stockChart.indicators.push(
      am5stock.VolumeProfile.new(root, {
        stockChart: stockChart,
        stockSeries: valueSeries,
        volumeSeries: volumeSeries,
      })
    );

    volumeProfile.setAll({
      draggable: true,
      upColor: am5.color(colorPositive),
      downColor: am5.color(colorNegative),
    });

    // Преобразуем данные в формат amCharts
    const am5Data = candlesData.map(c => ({
      Date: c.time * 1000,
      Open: c.open,
      High: c.high,
      Low: c.low,
      Close: c.close,
      Volume: (c as any).volume || 1,
    }));

    valueSeries.data.setAll(am5Data);
    volumeSeries.data.setAll(am5Data);

    // Курсор
    mainPanel.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        yAxis: valueAxis,
        xAxis: dateAxis,
        snapToSeries: [valueSeries],
        snapToSeriesBy: 'y!',
      })
    );

    stockChartRef.current = stockChart;

    return () => {
      root.dispose();
      stockChartRef.current = null;
    };
  }, [candlesData]);

  return (
    <div
      ref={chartDivRef}
      style={{ width: '100%', height: '400px', flex: 1 }}
    />
  );
};