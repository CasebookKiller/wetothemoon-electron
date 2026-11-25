```javascript
(async () => {
  const convId = '32e6f625-6be9-4fd1-a9a9-4c3b9312a0a2';
  const api = window.electronAPI;

  console.log('%c=== СРАВНЕНИЕ GW (БД) и PW (DOM) ===', 'font-weight:bold;color:#4d6bfe');

  // 1. Получаем БД
  const dbRes = await api.gatewayCacheMessages(convId);
  const db = dbRes.success ? dbRes.data : [];

  // 2. Получаем сырой DOM из PW
  console.log('Сканируем DOM в PW...');
  const pwRes = await api.gatewayDebugDumpPWState();
  const pw = pwRes.success ? pwRes.data : [];

  // 3. Собираем уникальные ключи (из БД и из PW)
  const allKeys = new Set([...db.map(m => m.pwKey), ...pw.map(m => m.pwKey)]);
  
  // Сортируем по числовому значению ключа (если это число)
  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });

  const report = [];

  for (const key of sortedKeys) {
    const dbMsg = db.find(m => m.pwKey === key);
    const pwMsg = pw.find(m => m.pwKey === key);

    if (!pwMsg) {
      report.push({
        pwKey: key,
        status: '❌ НЕТ В PW',
        dbSeq: dbMsg?.sequence,
        dbRole: dbMsg?.role,
        dbBranch: dbMsg?.branchTotal > 1 ? `${dbMsg.branchIndex}/${dbMsg.branchTotal}` : '-',
        dbText: (dbMsg?.contentPlain || '').slice(0, 40).replace(/\n/g, ' '),
        pwRole: '-',
        pwBranch: '-',
        pwText: '-'
      });
    } else if (!dbMsg) {
      report.push({
        pwKey: key,
        status: '⚠️ НЕТ В БД',
        dbSeq: '-',
        dbRole: '-',
        dbBranch: '-',
        dbText: '-',
        pwRole: pwMsg.role,
        pwBranch: pwMsg.branch,
        pwText: pwMsg.text
      });
    } else {
      // Есть в обоих
      const dbBranch = dbMsg.branchTotal > 1 ? `${dbMsg.branchIndex}/${dbMsg.branchTotal}` : '-';
      const isBranchMismatch = dbBranch !== pwMsg.branch;
      const isTextMismatch = (dbMsg.contentPlain || '').trim().substring(0, 40) !== pwMsg.text.substring(0, 40);
      
      let status = '✅ OK';
      if (isBranchMismatch) status = '🔀 ВЕТКИ НЕ СОВПАДАЮТ';
      else if (isTextMismatch && pwMsg.role === 'assistant') status = '📝 ТЕКСТ ОТЛИЧАЕТСЯ';
      else if (isTextMismatch) status = '📝 ТЕКСТ ОТЛИЧАЕТСЯ';

      report.push({
        pwKey: key,
        status,
        dbSeq: dbMsg.sequence,
        dbRole: dbMsg.role,
        dbBranch: dbBranch,
        dbText: (dbMsg.contentPlain || '').slice(0, 40).replace(/\n/g, ' '),
        pwRole: pwMsg.role,
        pwBranch: pwMsg.branch,
        pwText: pwMsg.text
      });
    }
  }

  console.table(report);
  console.log('%cИтог: БД (' + db.length + ') vs PW (' + pw.length + ')', 'font-weight:bold;color:green');
  
  // Ищем разрывы sequence в БД
  const seqs = db.map(m => m.sequence).sort((a,b) => a-b);
  const gaps = [];
  for (let i = 1; i < seqs.length; i++) {
    if (seqs[i] !== seqs[i - 1] + 1) gaps.push(`${seqs[i-1]}→${seqs[i]}`);
  }
  if (gaps.length) {
    console.warn('⚠️ РАЗРЫВЫ sequence в БД:', gaps.join(', '));
  } else {
    console.log('✓ Разрывов sequence в БД нет.');
  }
})();
```

проверка по всем веткам
```javascript
(async () => {
  const convId = '32e6f625-6be9-4fd1-a9a9-4c3b9312a0a2';
  const api = window.electronAPI;

  // 1. Открыть диалог
  await api.gatewayOpenConversation(convId);
  await new Promise(r => setTimeout(r, 1500));

  // 2. Снять ветку 2/2 (текущую)
  const pw2 = await api.gatewayDebugDumpPWState();
  const msg43_branch2 = (pw2.data || []).find(m => m.pwKey === '43');
  console.log('BEFORE — 43 pw:', msg43_branch2?.branch, '| text:', msg43_branch2?.text);

  // 3. Переключить на 1/2
  const sw1 = await api.gatewaySwitchBranch('43', 'prev');
  console.log('switch to prev:', sw1);
  await new Promise(r => setTimeout(r, 2000));

  // 4. Снять ветку 1/2
  const pw1 = await api.gatewayDebugDumpPWState();
  const msg43_branch1 = (pw1.data || []).find(m => m.pwKey === '43');
  console.log('AFTER — 43 pw:', msg43_branch1?.branch, '| text:', msg43_branch1?.text);

  // 5. Сравнить
  const sameText = msg43_branch1?.text === msg43_branch2?.text;
  console.log('%c=== ВЫВОД ===', 'font-weight:bold;color:#4d6bfe');
  if (sameText) {
    console.warn('⚠ Текст в обеих ветках ОДИНАКОВЫЙ. Возможно, PW не переключил содержимое.');
  } else {
    console.log('✓ Текст в ветках РАЗНЫЙ — ветки в PW работают.');
  }
  console.log('  Ветка 1/2 text: "', msg43_branch1?.text, '"');
  console.log('  Ветка 2/2 text: "', msg43_branch2?.text, '"');

  // 6. Вернуть на 2/2
  await api.gatewaySwitchBranch('43', 'next');
  console.log('Возвращено на next');
})();
```

```javascript
(async () => {
  const convId = '32e6f625-6be9-4fd1-a9a9-4c3b9312a0a2';
  const r = await window.electronAPI.gatewayDebugMessagesAll(convId);
  if (!r.success) { console.error(r.error); return; }
  console.log('Всего записей в БД:', r.data.length);
  console.log('Активных:', r.data.filter(m => m.is_active === 1).length);
  console.log('Неактивных:', r.data.filter(m => m.is_active === 0).length);
  console.table(
    r.data
      .filter(m => ['41', '43', '47', '48', '49'].includes(m.pw_key))
      .map(m => ({
        id: m.id.slice(-20),
        pw_key: m.pw_key,
        seq: m.sequence,
        role: m.role,
        br: `${m.branch_index ?? '-'}/${m.branch_total ?? '-'}`,
        active: m.is_active,
        hash: m.message_hash?.slice(0, 8),
        preview: m.preview?.slice(0, 30),
      }))
  );
})();
```