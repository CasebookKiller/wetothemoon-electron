src/main/services/db/
├── index.ts                  # реэкспорт — точка входа для совместимости
├── connection.ts             # getDatabase(), singleton, PRAGMA
├── schema.ts                 # initializeSchema() + все миграции
├── types.ts                  # общие типы строк (EntityRow, RelationRow, ...)
│
├── entities.ts               # upsertEntity, updateEntity, deleteEntity,
│                             # listEntitiesForDropdown, searchEntities, ...
├── relations.ts              # addRelation, updateRelation, deleteRelation,
│                             # getRelationDetails, ...
├── observations.ts           # addObservation, updateObservation,
│                             # deleteObservation, getObservationDetails, ...
├── sources.ts                # addSource, updateSource, deleteSource,
│                             # getSourceDetails, ...
│
├── audit.ts                  # auditChange, getAuditLog, listAuditLogTables,
│                             # listAuditLogActions, markRecordAsFalse,
│                             # markRecordsAsFalse
├── rawDumps.ts               # addRawDumpRecord, findLatestRawDump,
│                             # updateRawDumpSections, getDumpSectionsUpdatedAt,
│                             # listDumps, deleteDumpsByEntity, hasRawDumpForInn
├── kadDumps.ts               # getKadDump, upsertKadDump, touchKadDump,
│                             # listKadDumps, listKadDumpsByShard,
│                             # countKadDumpsByShard, getKadCardsCacheStatus,
│                             # deleteKadDump
│
├── courts.ts                 # upsertCourt, getCourtByTag, listCourts
├── judges.ts                 # upsertJudge, getJudgeByUuid, getJudgeDetails,
│                             # countJudges, listJudges, deleteJudge
├── scrapeProgress.ts         # markPrefixStatus, listPrefixesToScrape,
│                             # listAllPrefixesForSource, listSaturatedPrefixes,
│                             # getScrapeProgressSummary
├── caseEvents.ts             # addCaseEvent, listCaseEvents, updateCaseEvent,
│                             # deleteCaseEvent, countCaseEvents
│
├── entityDetails.ts          # getEntityDetails, getRelatedIds
├── search.ts                 # searchAll, SearchAllResult, SearchHit,
│                             # SearchHitKind
├── admin.ts                  # clearAllTables, createEntity, createSource,
│                             # createRelation, createObservation,
│                             # markEntityAsManual
└── caseInfo.ts               # чтение/запись case_info (id=1)