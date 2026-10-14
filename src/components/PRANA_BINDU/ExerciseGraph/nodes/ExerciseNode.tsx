// src/components/PRANA_BINDU/ExerciseGraph/nodes/ExerciseNode.tsx
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNodeData } from '../types';

type ExerciseNodeType = Node<ViewNodeData, 'exerciseNode'>;

export const ExerciseNode: React.FC<NodeProps<ExerciseNodeType>> = ({ data }) => {
  return (
    <div className="pb-node-inner">
      <div className="pb-node-inner__header">
        <span className="pb-node-inner__label">
          {data.labelRu ?? data.label}
        </span>
      </div>

      {(data.exerciseIcon || data.badge || data.footerText) && (
        <div className="pb-node-inner__footer">
          {data.exerciseIcon && (
            <span className="pb-node-inner__icon">{data.exerciseIcon}</span>
          )}
          {data.badge && (
            <span className="pb-node-inner__badge">{data.badge}</span>
          )}
          {data.footerText && (
            <span className="pb-node-inner__footer-text">
              {data.footerText}
            </span>
          )}
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