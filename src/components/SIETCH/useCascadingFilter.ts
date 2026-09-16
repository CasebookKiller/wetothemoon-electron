// src/components/SIETCH/useCascadingFilter.ts

import { useCallback, useState } from 'react';

export type FilterType = 'entity' | 'relation' | 'observation' | 'source';

export interface ActiveFilter {
  type: FilterType;
  id: number;
}

interface RelatedIds {
  entityIds: Set<number>;
  relationIds: Set<number>;
  observationIds: Set<number>;
  sourceIds: Set<number>;
}

interface FilterSources {
  displayEntities: any[];
  relations: any[];
  observations: any[];
  sources: any[];
}

export function useCascadingFilter(sources: FilterSources) {
  const api = (window as any).electronAPI;

  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [relatedIds, setRelatedIds] = useState<RelatedIds | null>(null);

  const applyFilter = useCallback(async (type: FilterType, id: number) => {
    setActiveFilter({ type, id });
    try {
      const res = await api.getRelatedIds(type, id);
      if (res.success && res.data) {
        setRelatedIds({
          entityIds: new Set(res.data.entityIds),
          relationIds: new Set(res.data.relationIds),
          observationIds: new Set(res.data.observationIds),
          sourceIds: new Set(res.data.sourceIds),
        });
      }
    } catch (e) {
      console.error('Ошибка получения связанных ID:', e);
    }
  }, [api]);

  const clearFilter = useCallback(() => {
    setActiveFilter(null);
    setRelatedIds(null);
  }, []);

  const filteredEntities = relatedIds
    ? sources.displayEntities.filter((r) => relatedIds.entityIds.has(r.id))
    : sources.displayEntities;

  const filteredRelations = relatedIds
    ? sources.relations.filter((r) => relatedIds.relationIds.has(r.id))
    : sources.relations;

  const filteredObservations = relatedIds
    ? sources.observations.filter((r) => relatedIds.observationIds.has(r.id))
    : sources.observations;

  const filteredSources = relatedIds
    ? sources.sources.filter((r) => relatedIds.sourceIds.has(r.id))
    : sources.sources;

  return {
    activeFilter,
    relatedIds,
    applyFilter,
    clearFilter,
    filteredEntities,
    filteredRelations,
    filteredObservations,
    filteredSources,
  };
}