import React, { useState, useEffect } from 'react';
import { Dropdown } from 'primereact/dropdown';

interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
}

const minuteOptions = Array.from({ length: 60 }, (_, i) => ({ label: `${i}`, value: `${i}` }));
const hourOptions = Array.from({ length: 24 }, (_, i) => ({ label: `${i}`, value: `${i}` }));
const dayOfMonthOptions = Array.from({ length: 31 }, (_, i) => ({ label: `${i + 1}`, value: `${i + 1}` }));
const monthOptions = [
  { label: 'Январь', value: '1' },
  { label: 'Февраль', value: '2' },
  { label: 'Март', value: '3' },
  { label: 'Апрель', value: '4' },
  { label: 'Май', value: '5' },
  { label: 'Июнь', value: '6' },
  { label: 'Июль', value: '7' },
  { label: 'Август', value: '8' },
  { label: 'Сентябрь', value: '9' },
  { label: 'Октябрь', value: '10' },
  { label: 'Ноябрь', value: '11' },
  { label: 'Декабрь', value: '12' },
];
const dayOfWeekOptions = [
  { label: 'Воскресенье', value: '0' },
  { label: 'Понедельник', value: '1' },
  { label: 'Вторник', value: '2' },
  { label: 'Среда', value: '3' },
  { label: 'Четверг', value: '4' },
  { label: 'Пятница', value: '5' },
  { label: 'Суббота', value: '6' },
];

// Парсит cron в объект
const parseCron = (cron: string) => {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return { minute: '*', hour: '*', dom: '*', month: '*', dow: '*' };
  return {
    minute: parts[0],
    hour: parts[1],
    dom: parts[2],
    month: parts[3],
    dow: parts[4],
  };
};

export const CronBuilder: React.FC<CronBuilderProps> = ({ value, onChange }) => {
  const [minute, setMinute] = useState('*');
  const [hour, setHour] = useState('*');
  const [dom, setDom] = useState('*');
  const [month, setMonth] = useState('*');
  const [dow, setDow] = useState('*');

  useEffect(() => {
    if (value) {
      const parsed = parseCron(value);
      setMinute(parsed.minute);
      setHour(parsed.hour);
      setDom(parsed.dom);
      setMonth(parsed.month);
      setDow(parsed.dow);
    }
  }, [value]);

  const updateCron = () => {
    const cronStr = `${minute} ${hour} ${dom} ${month} ${dow}`;
    onChange(cronStr);
  };

  const addWildcard = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter('*');
    // Триггерим обновление
    setTimeout(updateCron, 0);
  };

  // При изменении любого поля пересобираем cron
  React.useEffect(() => {
    updateCron();
  }, [minute, hour, dom, month, dow]);

  const dropdownStyle = { width: '100%' };

  return (
    <div className="p-fluid">
      <div className="grid">
        <div className="col-2">
          <label>Минуты</label>
          <Dropdown
            value={minute}
            options={[
              { label: '*', value: '*' },
              ...minuteOptions
            ]}
            onChange={e => setMinute(e.value)}
            style={dropdownStyle}
          />
        </div>
        <div className="col-2">
          <label>Часы</label>
          <Dropdown
            value={hour}
            options={[
              { label: '*', value: '*' },
              ...hourOptions
            ]}
            onChange={e => setHour(e.value)}
            style={dropdownStyle}
          />
        </div>
        <div className="col-2">
          <label>День</label>
          <Dropdown
            value={dom}
            options={[
              { label: '*', value: '*' },
              ...dayOfMonthOptions
            ]}
            onChange={e => setDom(e.value)}
            style={dropdownStyle}
          />
        </div>
        <div className="col-3">
          <label>Месяц</label>
          <Dropdown
            value={month}
            options={[
              { label: '*', value: '*' },
              ...monthOptions
            ]}
            onChange={e => setMonth(e.value)}
            style={dropdownStyle}
          />
        </div>
        <div className="col-3">
          <label>День недели</label>
          <Dropdown
            value={dow}
            options={[
              { label: '*', value: '*' },
              ...dayOfWeekOptions
            ]}
            onChange={e => setDow(e.value)}
            style={dropdownStyle}
          />
        </div>
      </div>
      <small className="text-color-secondary">
        {minute} {hour} {dom} {month} {dow}
      </small>
    </div>
  );
};