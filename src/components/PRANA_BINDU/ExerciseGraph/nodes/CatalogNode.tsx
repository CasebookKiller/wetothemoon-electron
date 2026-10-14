// src/components/PRANA_BINDU/ExerciseGraph/nodes/CatalogNode.tsx
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNodeData } from '../types';

type CatalogNodeType = Node<ViewNodeData, 'catalogNode'>;

export const CatalogNode: React.FC<NodeProps<CatalogNodeType>> = ({ data }) => {
  return (
    <div className="pb-node-inner">
      <div className="pb-node-inner__header pb-node-inner__header--catalog">
        <span className="pb-node-inner__label pb-node-inner__label--catalog">
          {data.labelRu ?? data.label}
        </span>
      </div>

      {data.footerText && (
        <div className="pb-node-inner__footer pb-node-inner__footer--catalog">
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