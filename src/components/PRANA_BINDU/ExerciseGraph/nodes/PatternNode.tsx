// src/components/PRANA_BINDU/ExerciseGraph/nodes/PatternNode.tsx
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNodeData } from '../types';

type PatternNodeType = Node<ViewNodeData, 'patternNode'>;

export const PatternNode: React.FC<NodeProps<PatternNodeType>> = ({ data }) => {
  return (
    <div className="pb-node-inner">
      <div className="pb-node-inner__header pb-node-inner__header--pattern">
        <span className="pb-node-inner__label pb-node-inner__label--pattern">
          {data.labelRu ?? data.label}
        </span>
      </div>

      <div className="pb-node-inner__body" />

      {data.footerText && (
        <div className="pb-node-inner__footer pb-node-inner__footer--pattern">
          <span className="pb-node-inner__footer-text">
            {data.footerText}
          </span>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        data-tooltip="вход · тянуть сюда"
      />
      <Handle
        type="source"
        position={Position.Right}
        data-tooltip="выход · тянуть отсюда"
      />
    </div>
  );
};