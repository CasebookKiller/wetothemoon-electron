// src/components/PRANA_BINDU/PANELS/NutritionPanel/NutritionPanel.tsx

import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';

interface Props {
  className?: string;
}

function getTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MEAL_OPTIONS = [
  { label: 'Завтрак', value: 'breakfast' },
  { label: 'Обед', value: 'lunch' },
  { label: 'Ужин', value: 'dinner' },
  { label: 'Перекус', value: 'snack' },
];

export const NutritionPanel: React.FC<Props> = ({ className }) => {
  const api = (window as any).electronAPI;
  const today = getTodayIso();

  // ==================== Вода ====================
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterLoading, setWaterLoading] = useState(false);
  const [waterGoal, setWaterGoal] = useState(2100); // Дефолт, если нет веса
  const [weekWater, setWeekWater] = useState<Record<string, number>>({});

  // ==================== Вес ====================
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState<number | null>(null);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightStatus, setWeightStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // ==================== Питание ====================
  const [nutritionItems, setNutritionItems] = useState<any[]>([]);
  const [totals, setTotals] = useState({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 });

  const [mealType, setMealType] = useState('breakfast');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [savingFood, setSavingFood] = useState(false);

  // ==================== Загрузка данных ====================
  const loadWater = async () => {
    if (!api?.pb?.listWater) return;
    setWaterLoading(true);
    try {
      const todayRes = await api.pb.listWater(today);
      if (todayRes?.success) setWaterTotal(todayRes.total ?? 0);

      if (api?.pb?.getWaterRange) {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const fromIso = d.toISOString().slice(0, 10);
        const rangeRes = await api.pb.getWaterRange(fromIso, today);
        if (rangeRes?.success) setWeekWater(rangeRes.data ?? {});
      }
    } finally {
      setWaterLoading(false);
    }
  };

  const loadWeight = async () => {
    if (!api?.pb?.listWeights) return;
    const res = await api.pb.listWeights(30); // последние 30 дней
    if (res?.success && res.latest) {
      setLatestWeight(res.latest.weight_kg);
      setWeightInput(res.latest.date === today ? res.latest.weight_kg : null);
    }
  };

  const loadNutrition = async () => {
    if (!api?.pb?.listNutrition) return;
    const res = await api.pb.listNutrition(today);
    if (res?.success) {
      setNutritionItems(res.items ?? []);
      if (res.totals) setTotals(res.totals);
    }
  };

  useEffect(() => {
    void loadWater();
    void loadWeight();
    void loadNutrition();

    // Расчёт цели воды от последнего веса (30 мл/кг)
    (async () => {
      if (!api?.pb?.listWeights) return;
      const res = await api.pb.listWeights(30);
      if (res?.success && res.latest?.weightKg) {
        setWaterGoal(Math.round(res.latest.weightKg * 30));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== Обработчики ====================
  const addWater = async (amount: number) => {
    if (!api?.pb?.addWater) return;
    setWaterLoading(true);
    try {
      await api.pb.addWater(today, amount);
      await loadWater();
    } finally {
      setWaterLoading(false);
    }
  };

  const saveWeight = async () => {
    if (!api?.pb?.addWeight) {
      console.error('[Nutrition] addWeight не доступен в preload');
      setWeightStatus('error');
      return;
    }
    if (weightInput == null) {
      setWeightStatus('error');
      return;
    }
    setWeightSaving(true);
    setWeightStatus('idle');
    try {
      const res = await api.pb.addWeight(today, weightInput);
      console.log('[Nutrition] addWeight res:', res);
      if (res?.success) {
        setWeightStatus('ok');
        await loadWeight();
        setTimeout(() => setWeightStatus('idle'), 2000);
      } else {
        setWeightStatus('error');
        console.error('[Nutrition] addWeight failed:', res?.error);
      }
    } catch (e) {
      setWeightStatus('error');
      console.error('[Nutrition] addWeight exception:', e);
    } finally {
      setWeightSaving(false);
    }
  };

  const addFood = async () => {
    if (!api?.pb?.addNutrition || !foodName.trim()) return;
    setSavingFood(true);
    try {
      await api.pb.addNutrition({
        date: today,
        mealType,
        foodName: foodName.trim(),
        calories: calories || 0,
        proteinG: protein || 0,
        fatG: fat || 0,
        carbsG: carbs || 0,
      });
      setFoodName('');
      setCalories(null);
      setProtein(null);
      setFat(null);
      setCarbs(null);
      await loadNutrition();
    } finally {
      setSavingFood(false);
    }
  };

  const deleteFood = async (id: number) => {
    if (!api?.pb?.deleteNutrition) return;
    await api.pb.deleteNutrition(id);
    await loadNutrition();
  };

  // ==================== Рендер ====================
  return (
    <Panel
      header="Питание и Вода"
      className={`shadow-5 mb-3 pb-panel ${className ?? ''}`}
    >
      <div className="pb-connections" style={{ padding: '0.5rem 0.75rem' }}>
        
        {/* ==================== ВОДА ==================== */}
        <div className="pb-connections__block">
          <div className="pb-connections__title">
            <i className="pi pi-tint" /> Вода
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {waterTotal} / {waterGoal} мл
            </span>
          </div>

          {/* Прогресс-бар */}
          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (waterTotal / waterGoal) * 100)}%`,
                background: waterTotal >= waterGoal ? '#6fbf73' : 'var(--pb-accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button label="+200" className="pb-soft p-button-sm" style={{ flex: 1 }} onClick={() => addWater(200)} disabled={waterLoading} />
            <Button label="+250" className="pb-soft p-button-sm" style={{ flex: 1 }} onClick={() => addWater(250)} disabled={waterLoading} />
            <Button label="+500" className="pb-soft p-button-sm" style={{ flex: 1 }} onClick={() => addWater(500)} disabled={waterLoading} />
          </div>

          {/* Недельный график */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '40px', gap: '4px' }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              const dateStr = d.toISOString().slice(0, 10);
              const val = weekWater[dateStr] || 0;
              const pct = Math.min(100, (val / waterGoal) * 100);
              
              return (
                <div key={dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} title={`${dateStr}: ${val} мл`}>
                  <div style={{ width: '100%', height: '30px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: `${pct}%`, background: val >= waterGoal ? '#6fbf73' : 'var(--pb-accent)', opacity: val > 0 ? 1 : 0 }} />
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--tg-hint)' }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][(d.getDay() + 6) % 7]}
                  </span>
                </div>
              );
            })}
          </div>
          <small style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--tg-hint)' }}>
            Цель {waterGoal} мл (30 мл на кг веса). Выпивайте стакан после пробуждения.
          </small>
        </div>

        {/* ==================== ВЕС ==================== */}
        <div className="pb-connections__block">
          <div className="pb-connections__title">
            <i className="pi pi-chart-line" /> Вес
            {latestWeight != null && (
              <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {latestWeight.toFixed(1)} кг
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
            <InputNumber
              value={weightInput}
              onValueChange={(e) => setWeightInput(e.value ?? null)}
              mode="decimal"
              minFractionDigits={1}
              maxFractionDigits={2}
              placeholder="Вес (кг)"
              className="pb-debug__input"
              style={{ flex: 1 }}
            />
            <Button
              label={weightSaving ? '...' : 'Сохранить'}
              icon={weightStatus === 'ok' ? 'pi pi-check' : weightStatus === 'error' ? 'pi pi-times' : 'pi pi-save'}
              className={weightStatus === 'ok' ? 'pb p-button-sm' : weightStatus === 'error' ? 'pb-destructive-soft p-button-sm' : 'pb p-button-sm'}
              onClick={saveWeight}
              disabled={weightSaving || weightInput == null}
            />
          </div>
          {weightStatus === 'ok' && (
            <small style={{ fontSize: '0.7rem', color: '#6fbf73', marginTop: '0.25rem', display: 'block' }}>Сохранено</small>
          )}
          {weightStatus === 'error' && (
            <small style={{ fontSize: '0.7rem', color: '#ec3942', marginTop: '0.25rem', display: 'block' }}>Ошибка сохранения (см. консоль)</small>
          )}
          
          {/* Последнее сохранение — чтобы было видно, что данные пишутся */}
          {latestWeight != null && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--tg-hint)' }}>
              Последнее сохранение: <b style={{ color: 'var(--pb-accent)', fontFamily: 'monospace' }}>{latestWeight.toFixed(1)} кг</b>
            </div>
          )}
        </div>

        {/* ==================== ПИТАНИЕ ==================== */}
        <div className="pb-connections__block">
          <div className="pb-connections__title">
            <i className="pi pi-apple" /> Питание
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Dropdown
              value={mealType}
              options={MEAL_OPTIONS}
              onChange={(e) => setMealType(e.value)}
              panelClassName="pb-dropdown-panel"
              className="w-full"
            />
            <InputText
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="Что съели?"
              className="w-full"
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <InputNumber value={calories} onValueChange={(e) => setCalories(e.value ?? null)} placeholder="Ккал" className="pb-debug__input" style={{ width: '100%' }} />
              <InputNumber value={protein} onValueChange={(e) => setProtein(e.value ?? null)} placeholder="Белки (г)" className="pb-debug__input" style={{ width: '100%' }} />
              <InputNumber value={fat} onValueChange={(e) => setFat(e.value ?? null)} placeholder="Жиры (г)" className="pb-debug__input" style={{ width: '100%' }} />
              <InputNumber value={carbs} onValueChange={(e) => setCarbs(e.value ?? null)} placeholder="Углеводы (г)" className="pb-debug__input" style={{ width: '100%' }} />
            </div>

            <Button label="Добавить" icon="pi pi-plus" className="pb p-button-sm" onClick={addFood} disabled={savingFood || !foodName.trim()} />
          </div>

          {nutritionItems.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {nutritionItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid var(--surface-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>{item.food_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>
                        {item.calories} ккал · Б{item.protein_g} Ж{item.fat_g} У{item.carbs_g}
                      </div>
                    </div>
                    <Button
                      icon="pi pi-times"
                      className="pb-destructive-soft p-button-sm"
                      style={{ width: '1.5rem', height: '1.5rem', padding: 0 }}
                      onClick={() => deleteFood(item.id)}
                    />
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '0.75rem', paddingTop: '0.5rem',
                  borderTop: '1px solid var(--surface-border)',
                  display: 'flex', justifyContent: 'space-between',
                  fontWeight: 600, color: 'var(--pb-accent)',
                }}
              >
                <span>Итого:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {totals.calories} ккал · Б{totals.proteinG.toFixed(1)} Ж{totals.fatG.toFixed(1)} У{totals.carbsG.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};