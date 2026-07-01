// src/components/TRADING_ASSISTANT/StreamTab/StreamTab.tsx

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';

type Timeframe = 1 | 5 | 15 | 60;

interface Props {
  stream: { active: boolean; token: string; displayTimeframe: Timeframe };
  updateStream: (patch: Partial<{ active: boolean; token: string; displayTimeframe: Timeframe }>) => void;
  startStream: () => void;
  stopStream: () => void;
}

const timeframeOptions: { label: string; value: Timeframe }[] = [
  { label: '1m', value: 1 },
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '1h', value: 60 },
];

export const StreamTab: React.FC<Props> = ({ stream, updateStream, startStream, stopStream }) => {
  return (
    <Card title="Market Stream" className="surface-ground">
      <div className="p-fluid p-formgrid p-grid">
        <div className="p-field p-col-12 p-md-6">
          <label>Token (read‑only)</label>
          <InputText value={stream.token} onChange={e => updateStream({ token: e.target.value })} />
        </div>
        <div className="p-field p-col-6 p-md-3">
          <label>Timeframe</label>
          <Dropdown
            value={stream.displayTimeframe}
            options={timeframeOptions}
            onChange={e => updateStream({ displayTimeframe: e.value as Timeframe })}
          />
        </div>
        <div className="p-field p-col-6 p-md-3 p-d-flex p-ai-end">
          <Button label="Start Stream" onClick={startStream} disabled={stream.active} className="p-mr-2" />
          <Button label="Stop Stream" onClick={stopStream} disabled={!stream.active} className="p-button-danger" />
        </div>
      </div>
      <div className="p-mt-2">
        <span style={{ color: stream.active ? '#4caf50' : '#d32f2f' }}>
          {stream.active ? '● Live' : '○ Stopped'}
        </span>
      </div>
    </Card>
  );
};