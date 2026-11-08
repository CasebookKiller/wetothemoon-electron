// src/components/PRANA_BINDU/PANELS/Dashboard/Dashboard.tsx

import AppIcon from '@/components/COMMON/AppIcon/AppIcon';
import React, { useEffect, useState } from 'react';

interface Props {
  onOpenTraining: (tab: 'runs' | 'plan' | 'calendar') => void;
  onOpenHealth: (tab: 'wellness' | 'nutrition') => void;
  onOpenAnalytics: () => void;
  refreshKey?: number;
}

export const Dashboard: React.FC<Props> = ({ onOpenTraining, onOpenHealth, onOpenAnalytics, refreshKey }) => {
  const api = (window as any).electronAPI;
  const [lastRun, setLastRun] = useState<any>(null);
  const [todayPlans, setTodayPlans] = useState<any[]>([]);
  const [todayWater, setTodayWater] = useState<{ total: number, goal: number }>({ total: 0, goal: 2500 });
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const [factsRes, plansRes, waterRes, recRes, weightRes] = await Promise.all([
          api.pb.listRunFacts('2000-01-01', today),
          api.pb.listPlanEvents(today, today),
          api.pb.listWater(today),
          api.pb.listRecoveryLogs(today, today),
          api.pb.listWeights(30)
        ]);
        if (!alive) return;

        if (factsRes?.success && factsRes.items?.length > 0) {
          const sorted = [...factsRes.items].sort((a, b) => b.date.localeCompare(a.date));
          setLastRun(sorted[0]);
        }

        if (plansRes?.success && plansRes.items?.length > 0) {
          setTodayPlans(plansRes.items);
        } else {
          setTodayPlans([]);
        }

        const weight = weightRes?.latest?.weight_kg ?? 70;
        const hasRun = plansRes?.items?.some((p: any) => p.sport?.toLowerCase().includes('run')) || (factsRes?.items?.some((f: any) => f.date === today));
        const goal = Math.round(weight * 30 + (hasRun ? 500 : 0));
        if (waterRes?.success) setTodayWater({ total: waterRes.total ?? 0, goal });

        if (recRes?.success && recRes.items?.length > 0) {
          setHealth(recRes.items[0]);
        }
      } catch (e) {
        console.error('Dashboard load error', e);
      }
    })();
    return () => { alive = false; };
  }, [refreshKey, api]);

  const cardClass = "surface-card p-4 shadow-2 border-round h-full cursor-pointer transition-colors transition-duration-150 hover:bg-primary-reverse hover:text-primary";

  return (
    <div className="flex flex-wrap mt-2 mb-4" style={{ margin: '0 -0.5rem' }}>
      
      {/* 1. ТРЕНИРОВКИ (50%) */}
      <div className="col-12 lg:col-6 p-2">
        <div className={cardClass} onClick={() => onOpenTraining('runs')}>
          <div className="pb-module-name flex justify-content-between align-items-center">
            <span><AppIcon name="chart-bar" color="accent" className="mr-2" />Тренировки</span>
            <AppIcon name="arrow-right" className="text-xs" style={{ opacity: 0.5 }} />
          </div>
          
          <div className="mt-3 flex flex-column gap-3">
            <div>
              <div className="text-xs pb-hint uppercase tracking-wide mb-1">Последняя пробежка</div>
              {lastRun ? (
                <div className="flex justify-content-between align-items-baseline">
                  <span className="text-xl font-bold" style={{ color: 'var(--pb-accent)' }}>{lastRun.actual_km?.toFixed(2)} км</span>
                  <span className="text-sm pb-hint">{lastRun.date} · {lastRun.actual_pace ?? '—'}</span>
                </div>
              ) : (
                <div className="text-sm pb-hint">Нет данных</div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem' }}>
              <div className="text-xs pb-hint uppercase tracking-wide mb-1">
                План на сегодня {todayPlans.length > 0 && `(${todayPlans.length})`}
              </div>
              {todayPlans.length > 0 ? (
                <div className="flex flex-column gap-2">
                  {todayPlans.map((plan, idx) => (
                    <div key={idx} className="flex flex-column">
                      <div className="text-sm font-bold text-ellipsis overflow-hidden white-space-nowrap" title={plan.name}>
                        {plan.name}
                      </div>
                      <div className="text-xs pb-hint">
                        {plan.sport ? plan.sport.toUpperCase() : 'WORKOUT'}
                        {plan.distanceM ? ` · ${(plan.distanceM / 1000).toFixed(1)} км` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm pb-hint">На сегодня плана нет</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. ЗДОРОВЬЕ И ВОДА (50%) */}
      <div className="col-12 lg:col-6 p-2">
        <div className={cardClass} onClick={() => onOpenHealth('wellness')}>
          
          {/* Шапка виджета */}
          <div className="pb-module-name flex align-items-center justify-content-between" style={{ gap: '0.5rem' }}>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 1 }}>
              <AppIcon name="heart" color="accent" className="mr-2" />
              Здоровье и Вода
            </span>
            <div style={{ flexShrink: 0 }}>
              <button 
                className="pb-ref-category-chip" 
                style={{ padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                onClick={(e) => { e.stopPropagation(); onOpenAnalytics(); }}
              >
                <AppIcon name="chart-pie" color="accent" /> Аналитика
              </button>
            </div>
          </div>
          
          {/* Контент (используем flex вместо PrimeFlex grid, чтобы не было горизонтальной прокрутки) */}
          <div className="mt-3 flex flex-column md:flex-row gap-3">
            {/* Левая колонка: Здоровье */}
            <div className="flex flex-column gap-2" style={{ flex: 1, minWidth: 0 }}>
              <div className="text-xs pb-hint uppercase tracking-wide">Здоровье</div>
              {health ? (
                <>
                  <div className="flex justify-content-between text-sm">
                    <span className="pb-hint">Пульс покоя:</span> <b>{health.resting_hr ?? '—'} bpm</b>
                  </div>
                  <div className="flex justify-content-between text-sm">
                    <span className="pb-hint">Сон:</span> <b>{health.sleep_hours ? `${health.sleep_hours.toFixed(1)} ч` : '—'}</b>
                  </div>
                  <div className="flex justify-content-between text-sm">
                    <span className="pb-hint">Форма (CTL / ATL):</span> <b>{health.ctl?.toFixed(0) ?? '—'} / {health.atl?.toFixed(0) ?? '—'}</b>
                  </div>
                </>
              ) : (
                <div className="text-sm pb-hint">Нет данных</div>
              )}
            </div>

            {/* Правая колонка: Вода */}
            <div className="flex flex-column gap-2" style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--surface-border)', paddingLeft: '1rem' }}>
              <div className="text-xs pb-hint uppercase tracking-wide">Вода</div>
              <div>
                <div className="text-2xl font-bold" style={{ color: todayWater.total >= todayWater.goal ? '#6fbf73' : '#6ab2f2' }}>
                  {todayWater.total} <span className="text-sm font-normal pb-hint">/ {todayWater.goal} мл</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (todayWater.total / todayWater.goal) * 100)}%`, height: '100%', background: todayWater.total >= todayWater.goal ? '#6fbf73' : '#6ab2f2' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};