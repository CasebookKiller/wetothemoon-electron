// src/components/SIETCH/DatabaseHelp.tsx

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';

export interface DatabaseHelpProps {
  visible: boolean;
  onHide: () => void;
}

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre
    className="p-2 border-round text-sm"
    style={{
      background: 'var(--tg-theme-secondary-bg-color)',
      border: '1px solid var(--tg-theme-hint-color)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}
  >
    {children}
  </pre>
);

export const DatabaseHelp: React.FC<DatabaseHelpProps> = ({ visible, onHide }) => {
  return (
    <Dialog
      visible={visible}
      style={{ width: '960px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={<span className="p-panel-title">Справка по базе данных</span>}
      footer={
        <div className="p-panel-footer flex justify-content-end">
          <Button
            label="Закрыть"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
          />
        </div>
      }
    >
      <TabView>
        {/* ============ 1. БЫСТРЫЙ СТАРТ ============ */}
        <TabPanel header="Быстрый старт">
          <Panel header="Порядок работы" className="mb-3">
            <ol className="pl-4">
              <li className="mb-2">
                <b>Источник</b> — создайте хотя бы один, если его ещё нет.
                Без источника запись будет «висеть в воздухе».
              </li>
              <li className="mb-2">
                <b>Сущности</b> — создайте сначала тех, о ком/чём собираетесь
                делать наблюдения и связи.
              </li>
              <li className="mb-2">
                <b>Наблюдения</b> — факты о сущности (ИНН, адрес, e-mail,
                должность и т.п.).
              </li>
              <li className="mb-2">
                <b>Связи</b> — отношения между двумя сущностями (директор,
                учредитель, аффилированность).
              </li>
              <li className="mb-2">
                <b>Редактирование</b> — если ошиблись, откройте запись и нажмите
                «Редактировать».
              </li>
              <li className="mb-2">
                <b>Пометка «ложная»</b> — если факт не подтвердился, используйте
                кнопку «Пометить как ложную» в футере диалога. Запись не
                удаляется, но получает статус <code>false</code>.
              </li>
            </ol>
          </Panel>

          <Panel header="Как открыть диалог деталей" className="mb-3">
            <p>
              Кликните по <b>любой строке</b> в таблице. Откроется диалог с
              полной информацией. Внутри можно кликать по названиям сущностей и
              источников, чтобы «проваливаться» в связанные записи. Сверху
              появляется breadcrumb — по нему можно вернуться на любой уровень.
            </p>
          </Panel>

          <Panel header="Статусы записей">
            <ul className="pl-4">
              <li><b>unverified</b> — не проверено</li>
              <li><b>hypothesis</b> — рабочая гипотеза</li>
              <li><b>confirmed</b> — подтверждено</li>
              <li><b>false</b> — опровергнуто</li>
              <li><b>archived</b> — устарело</li>
            </ul>
          </Panel>
        </TabPanel>

        {/* ============ 2. СУЩНОСТИ ============ */}
        <TabPanel header="Сущности">
          <Panel header="Что это" className="mb-3">
            <p>
              Сущность — объект исследования: компания, ИП, физлицо, домен,
              email, телефон, IP, адрес, документ. Каждая сущность уникальна по
              паре (<code>type</code>, <code>value</code>).
            </p>
          </Panel>

          <Panel header="Типы сущностей" className="mb-3">
            <ul className="pl-4">
              <li><b>company</b> — юридическое лицо (ООО, АО, ПАО). Идентификатор — название или ОГРН.</li>
              <li><b>entrepreneur</b> — ИП. Идентификатор — ФИО или ОГРНИП.</li>
              <li><b>person</b> — физлицо. Идентификатор — ФИО.</li>
              <li><b>domain</b>, <b>email</b>, <b>phone</b>, <b>ip</b>, <b>address</b>, <b>document</b>, <b>other</b>.</li>
            </ul>
          </Panel>

          <Panel header="Примеры" className="mb-3">
            <p><b>Юрлицо:</b></p>
            <CodeBlock>{`type: company
value: ООО "Бизнес - Недвижимость"
label: ООО "Бизнес - Недвижимость"
confidence: 90
status: confirmed`}</CodeBlock>

            <p className="mt-3"><b>Физлицо:</b></p>
            <CodeBlock>{`type: person
value: Иванова Ольга Александровна
label: Иванова О.А.
confidence: 70
status: hypothesis`}</CodeBlock>

            <p className="mt-3"><b>Домен:</b></p>
            <CodeBlock>{`type: domain
value: example.org
label: example.org`}</CodeBlock>
          </Panel>

          <Panel header="Поле «Значение» vs «Название»">
            <p>
              <b>Значение (value)</b> — уникальный идентификатор. Для ЮЛ
              лучше использовать полное официальное название, для физлица — ФИО
              полностью.
            </p>
            <p>
              <b>Название (label)</b> — короткое отображаемое имя для удобства.
              Например, «Сбербанк» вместо «ПАО "Сбербанк России"».
            </p>
          </Panel>
        </TabPanel>

        {/* ============ 3. СВЯЗИ ============ */}
        <TabPanel header="Связи">
          <Panel header="Что это" className="mb-3">
            <p>
              Связь — направленное отношение между двумя сущностями:{' '}
              <code>subject --predicate--&gt; object</code>. Направление важно:
              «Иванов — директор Сбербанка» — это не то же самое, что «Сбербанк —
              директор Иванова».
            </p>
          </Panel>

          <Panel header="Типы связей (predicate)" className="mb-3">
            <ul className="pl-4">
              <li><b>employee_of</b> — сотрудник (person → company)</li>
              <li><b>director_of</b> — руководитель (person → company)</li>
              <li><b>owner_of</b> — владелец (person/company → company)</li>
              <li><b>founder_of</b> — учредитель (person/company → company)</li>
              <li><b>associated_with</b> — аффилирован (any → any)</li>
              <li><b>uses_domain</b> — использует домен (company → domain)</li>
              <li><b>located_at</b> — расположен по адресу (company → address)</li>
              <li><b>includes</b> — включает (company → company, подразделение)</li>
              <li><b>mentions</b> — упоминает</li>
              <li><b>resolves_to</b> — домен → IP</li>
              <li><b>individual_entrepreneur_of</b> — физлицо ↔ ИП (один и тот же человек)</li>
            </ul>
          </Panel>

          <Panel header="Пример" className="mb-3">
            <CodeBlock>{`subject: [2] Иванова Ольга Александровна (person)
predicate: director_of
object:  [1] ООО "Бизнес - Недвижимость" (company)
confidence: 95
status: confirmed
valid_from: 2024-01-15
evidence_text: выписка ЕГРЮЛ от 2024-03-01`}</CodeBlock>
          </Panel>

          <Panel header="Период действия">
            <p>
              <code>valid_from</code> / <code>valid_to</code> — даты в формате{' '}
              <code>YYYY-MM-DD</code>. Если связь действующая — заполните только{' '}
              <code>valid_from</code>. Если историческая — обе даты.
            </p>
          </Panel>
        </TabPanel>

        {/* ============ 4. НАБЛЮДЕНИЯ ============ */}
        <TabPanel header="Наблюдения">
          <Panel header="Что это" className="mb-3">
            <p>
              Наблюдение — конкретный факт о сущности. Одна сущность может иметь
              много наблюдений: ИНН, ОГРН, КПП, адрес, e-mail, телефон, сайт,
              должность, дата рождения и т.п.
            </p>
          </Panel>

          <Panel header="Типичные атрибуты" className="mb-3">
            <ul className="pl-4">
              <li><b>inn</b>, <b>ogrn</b>, <b>kpp</b> — реквизиты</li>
              <li><b>address</b> — юридический адрес</li>
              <li><b>email</b>, <b>phone</b>, <b>website</b> — контакты</li>
              <li><b>director</b> — ФИО руководителя (если хотите хранить как строку, а не как связь)</li>
              <li><b>activity</b> — основной вид деятельности</li>
              <li><b>job_title</b> — должность человека</li>
              <li><b>birth_date</b> — дата рождения</li>
              <li><b>status</b>, <b>registered_at</b>, <b>capital</b> — прочее</li>
            </ul>
          </Panel>

          <Panel header="Примеры" className="mb-3">
            <p><b>Для ЮЛ:</b></p>
            <CodeBlock>{`entity: [1] ООО "Бизнес - Недвижимость"
attribute: inn
value: 7734493271
confidence: 95`}</CodeBlock>

            <p className="mt-3"><b>Для физлица:</b></p>
            <CodeBlock>{`entity: [2] Иванова Ольга Александровна
attribute: email
value: o.ivanova@example.org
confidence: 60`}</CodeBlock>

            <p className="mt-3"><b>Для домена:</b></p>
            <CodeBlock>{`entity: [3] example.org
attribute: mx
value: 10 mail.example.org
confidence: 80`}</CodeBlock>
          </Panel>

          <Panel header="Наблюдение или связь?">
            <p>
              Если факт можно выразить простой парой «поле: значение» —
              используйте <b>наблюдение</b>. Если факт описывает отношение
              между двумя объектами и по нему нужен граф —{' '}
              <b>связь</b>.
            </p>
            <p>
              Пример: «директор — Иванов» можно хранить и как наблюдение{' '}
              (<code>director = Иванов</code>) и как связь{' '}
              (<code>Иванов --director_of--&gt; ООО</code>). Для графа связи
              предпочтительнее, потому что они создают узлы.
            </p>
          </Panel>
        </TabPanel>

        {/* ============ 5. ИСТОЧНИКИ ============ */}
        <TabPanel header="Источники">
          <Panel header="Что это" className="mb-3">
            <p>
              Источник — откуда взяты данные: сайт, официальный реестр,
              внутренний документ, соцсеть, скриншот, выгрузка через CLI.
              Привязывается к наблюдениям и связям, чтобы всегда можно было
              доказать происхождение факта.
            </p>
          </Panel>

          <Panel header="Типы источников (source_type)" className="mb-3">
            <ul className="pl-4">
              <li><b>website</b> — обычный сайт</li>
              <li><b>social</b> — соцсеть</li>
              <li><b>registry</b> — официальный реестр (ЕГРЮЛ, kad.arbitr и т.п.)</li>
              <li><b>document</b> — документ</li>
              <li><b>cli</b> — результат CLI-инструмента</li>
              <li><b>search</b> — поисковик</li>
              <li><b>screenshot</b> — скриншот</li>
              <li><b>company_system</b> — внутренняя система</li>
              <li><b>court</b> — судебный ресурс</li>
              <li><b>other</b> — прочее</li>
            </ul>
          </Panel>

          <Panel header="Происхождение (source_kind)" className="mb-3">
            <ul className="pl-4">
              <li><b>public_web</b> — открытый интернет</li>
              <li><b>internal_person</b> — сотрудник</li>
              <li><b>internal_document</b> — внутренний документ</li>
              <li><b>official_registry</b> — официальный реестр</li>
              <li><b>company_system</b> — корпоративная система</li>
              <li><b>cli_tool</b> — CLI-инструмент</li>
              <li><b>personal_observation</b> — личное наблюдение</li>
            </ul>
          </Panel>

          <Panel header="Уровни доступа (access_level)" className="mb-3">
            <ul className="pl-4">
              <li><b>public</b> — открыто (зелёный)</li>
              <li><b>internal</b> — внутреннее (синий)</li>
              <li><b>confidential</b> — конфиденциально (жёлтый)</li>
              <li><b>restricted</b> — ограниченный доступ (красный)</li>
            </ul>
          </Panel>

          <Panel header="Пример" className="mb-3">
            <CodeBlock>{`url: https://www.rusprofile.ru/id/1247700014870
title: Rusprofile — ООО "Бизнес - Недвижимость"
source_type: registry
source_kind: official_registry
provider: rusprofile.ru
collection_method: browser
reliability: 80
access_level: public`}</CodeBlock>
          </Panel>

          <Panel header="Надёжность (reliability)">
            <ul className="pl-4">
              <li>0–20 — очень слабый сигнал</li>
              <li>21–40 — возможное совпадение</li>
              <li>41–60 — требуется проверка</li>
              <li>61–80 — хорошее подтверждение</li>
              <li>81–100 — подтверждено несколькими источниками</li>
            </ul>
          </Panel>
        </TabPanel>

        {/* ============ 6. РЕДАКТИРОВАНИЕ ============ */}
        <TabPanel header="Редактирование">
          <Panel header="Как редактировать" className="mb-3">
            <ol className="pl-4">
              <li>Откройте запись — клик по строке таблицы.</li>
              <li>Нажмите <b>«Редактировать»</b> в футере диалога.</li>
              <li>Поля, доступные для редактирования, станут полями ввода. Поля, которые нельзя редактировать (ID, даты, ссылки на другие таблицы), останутся текстом.</li>
              <li>Нажмите <b>«Сохранить»</b> или <b>«Отмена»</b>.</li>
            </ol>
          </Panel>

          <Panel header="Происхождение записи (origin)" className="mb-3">
            <p>
              У каждой записи есть поле <code>origin</code>, которое
              отображается тегом «Источник записи» в диалоге.
            </p>
            <ul className="pl-4">
              <li>
                <b>авто</b> (синий) — запись создана автоматически из
                rusprofile. При следующей дозагрузке раздела поля{' '}
                <code>value</code>, <code>label</code>, <code>evidence_text</code>{' '}
                могут быть обновлены скрапером.
              </li>
              <li>
                <b>вручную</b> (жёлтый) — запись отредактирована или создана
                пользователем. Скрапер её <b>не перезаписывает</b>.
              </li>
            </ul>
            <p className="mt-2">
              Когда вы сохраняете изменения в записи с <code>origin='scraper'</code>,
              она автоматически становится <code>manual</code>. С этого момента
              скрапер её не тронет.
            </p>
          </Panel>

          <Panel header="Что редактируется, а что нет">
            <ul className="pl-4">
              <li><b>Сущности:</b> type, value, label, confidence, status, notes</li>
              <li><b>Связи:</b> predicate, confidence, status, valid_from, valid_to, evidence_text, notes</li>
              <li><b>Наблюдения:</b> attribute, value, confidence, notes</li>
              <li><b>Источники:</b> url, title, source_type, source_kind, provider, collection_method, authority_basis, reliability, access_level, notes</li>
            </ul>
            <p className="mt-2">
              Не редактируются: ID, даты создания, ссылки на родительские
              сущности (subject_id, entity_id, object_id, source_id).
            </p>
          </Panel>

          <Panel header="Пометка «ложная»">
            <p>
              Если факт не подтвердился, используйте кнопку{' '}
              <b>«Пометить как ложную»</b> в футере диалога. Запись:
            </p>
            <ul className="pl-4">
              <li>получает <code>status='false'</code>,</li>
              <li>в <code>notes</code> пишется причина,</li>
              <li><code>origin</code> переходит в <code>manual</code> (скрапер её не тронет),</li>
              <li>событие фиксируется в журнале <code>audit_log</code>.</li>
            </ul>
            <p className="mt-2">
              Записи лучше не удалять без необходимости — статус <code>false</code>{' '}
              сохраняет историю.
            </p>
          </Panel>
        </TabPanel>

        {/* ============ 7. УДАЛЕНИЕ ============ */}
        <TabPanel header="Удаление">
          <Panel header="Когда удалять, а когда помечать" className="mb-3">
            <p>
              Удаление — это <b>необратимая</b> операция: запись и её след в
              audit_log остаются только в виде «<i>была такая, удалена тогда-то</i>».
            </p>
            <p>
              <b>Рекомендуется</b> сначала использовать <code>status='false'</code> или{' '}
              <code>status='archived'</code> через кнопку <b>«Пометить как ложную»</b>{' '}
              в футере диалога. Это сохраняет историю и следы проверки.
            </p>
            <p>
              Удаляйте только когда:
            </p>
            <ul className="pl-4">
              <li>ошиблись при ручном создании и запись явно лишняя;</li>
              <li>обнаружили полный дубликат (например, сущность с опечаткой в value);</li>
              <li>данные собраны по ошибке (не тот ИНН, не то лицо).</li>
            </ul>
          </Panel>

          <Panel header="Удаление отдельной записи" className="mb-3">
            <ol className="pl-4">
              <li>Откройте диалог записи (клик по строке таблицы).</li>
              <li>Нажмите <b>«Удалить»</b> в футере диалога.</li>
              <li>В появившемся окне подтвердите удаление.</li>
            </ol>
            <p className="mt-2">
              Для <b>связи</b> и <b>наблюдения</b> — удаление простое, зависимостей нет.
              Для <b>сущности</b> и <b>источника</b> — есть нюансы (см. ниже).
            </p>
          </Panel>

          <Panel header="Удаление сущности" className="mb-3">
            <p>
              На сущность могут ссылаться другие записи — связи и наблюдения. Просто так
              удалить её нельзя, чтобы не порушить целостность базы.
            </p>
            <p>
              В диалоге удаления появится предупреждение с количеством связанных
              наблюдений и связей и <b>чекбокс «Каскадно удалить...»</b>.
            </p>
            <ul className="pl-4">
              <li>
                <b>Без галочки</b> — удаление заблокируется и вернёт ошибку со счётчиком
                зависимостей. Это защита от случайного нажатия.
              </li>
              <li>
                <b>С галочкой</b> — сначала удалятся все наблюдения и связи, где
                сущность участвует (subject или object), затем сама сущность.
              </li>
            </ul>
            <p className="mt-2">
              <b>Пример:</b> удаляем ООО «Ромашка». У неё 12 наблюдений (ИНН, ОГРН,
              адрес, ...) и 5 связей (директор, учредитель, ...). Ставим галочку —
              всё уедет одним действием.
            </p>
            <p className="mt-2 text-500">
              Если хотите удалить сущность, но <b>сохранить</b> связанные наблюдения —
              сначала откройте каждое наблюдение и вручную удалите, либо оставьте
              сущность со статусом <code>archived</code>.
            </p>
          </Panel>

          <Panel header="Удаление источника" className="mb-3">
            <p>
              На источник ссылаются наблюдения и связи (поле <code>source_id</code>).
              По умолчанию удаление блокируется.
            </p>
            <ul className="pl-4">
              <li>
                <b>Без галочки</b> — ошибка с указанием, сколько записей ссылается на
                источник.
              </li>
              <li>
                <b>С галочкой</b> — все наблюдения и связи, ссылающиеся на этот
                источник, получат <code>source_id = NULL</code> (источник обнуляется,
                но сами записи остаются). Затем источник удаляется.
              </li>
            </ul>
            <p className="mt-2">
              <b>Когда это полезно:</b> если источник был ошибочно указан для группы
              записей, но сами записи верные. Тогда удаление с отвязкой сохранит данные,
              убрав лишь ссылку.
            </p>
          </Panel>

          <Panel header="Опасная зона — полная очистка" className="mb-3">
            <p>
              В панели <b>«Таблицы»</b> главного окна БД есть кнопка{' '}
              <b>«Опасная зона»</b> (красная, с иконкой предупреждения). Она открывает
              диалог с тремя режимами:
            </p>
            <ul className="pl-4">
              <li>
                <b>Только таблицы БД</b> — удаляются все записи из{' '}
                <code>entities</code>, <code>relations</code>, <code>observations</code>,{' '}
                <code>sources</code>, <code>raw_dumps</code>, <code>audit_log</code>,{' '}
                <code>shards</code>. Файлы <code>.msgpack</code> остаются на диске.
              </li>
              <li>
                <b>Только файлы дампов</b> — удаляются все <code>.msgpack</code> из{' '}
                <code>raw_dumps</code>. Записи в БД остаются, но ссылки на файлы будут
                «битыми» — при попытке прочитать дамп получите ошибку.
              </li>
              <li>
                <b>И таблицы, и дампы</b> — полная очистка. Приложение вернётся в
                состояние «как после первого запуска».
              </li>
            </ul>

            <p className="mt-3">
              <b>Защита от случайного нажатия:</b> в диалоге нужно ввести слово{' '}
              <code>УДАЛИТЬ</code> заглавными буквами. Кнопка «Выполнить» неактивна, пока
              текст не совпадёт.
            </p>

            <p className="mt-3">
              <b>Что не удаляется:</b> запись <code>case_info</code> (id=1) остаётся, но
              в <code>audit_log</code> появляется след <code>action='clear_all'</code>.
            </p>

            <p className="mt-3 text-500">
              <b>Перед очисткой обязательно сделайте резервную копию базы.</b>{' '}
              Пока в приложении нет встроенной функции backup (появится в следующих
              шагах), сохраните файл вручную:
            </p>
            <CodeBlock>cp ~/.config/wetothemoon-electron/osint_data.db ~/osint_data.db.bak</CodeBlock>
          </Panel>

          <Panel header="Что происходит в audit_log" className="mb-3">
            <p>
              Каждая операция удаления фиксируется в <code>audit_log</code>:
            </p>
            <CodeBlock>{`action='delete'
        old_value=<полная запись до удаления в JSON>
        new_value=null (или "force=true; удалено наблюдений=N, связей=M" для каскада)
        reason='Удаление сущности через UI'`}</CodeBlock>
            <p className="mt-2">
              Для операции «Опасная зона»:
            </p>
            <CodeBlock>{`table_name='case_info'
        record_id=1
        action='clear_all'
        old_value=null
        new_value='Все таблицы данных очищены'
        reason='Полная очистка базы через UI'`}</CodeBlock>
            <p className="mt-2">
              Журнал <code>audit_log</code> сам не очищается при удалении сущности или
              источника — записи «переживают» удалённые объекты. Это позволяет
              восстановить историю.
            </p>
          </Panel>

          <Panel header="Что делать, если удалили лишнее">
            <p>
              <b>Отмены удаления нет.</b> Единственный способ восстановить данные:
            </p>
            <ol className="pl-4">
              <li>
                Если у вас есть резервная копия <code>osint_data.db</code> — закройте
                приложение, замените файл базы, откройте заново.
              </li>
              <li>
                Если есть сырой дамп (<code>.msgpack</code>) — можно заново
                прогнать скрапер по тому же ИНН, если не удаляли дампы.
              </li>
              <li>
                Если данные вводились вручную и без резервной копии — восстановить их
                уже нельзя.
              </li>
            </ol>
            <p className="mt-2">
              <b>Поэтому:</b> перед любой массовой операцией (Опасная зона, каскадное
              удаление сущности с десятками связей) — сохраните базу вручную.
            </p>
          </Panel>
        </TabPanel>

        {/* ============ 8. COOKBOOK ============ */}
        <TabPanel header="Примеры">
          <Panel header="ЮЛ и его сотрудники" className="mb-3">
            <p><b>Задача:</b> завести компанию и её директора, учредителя, главбуха.</p>
            <ol className="pl-4">
              <li>Создать источник: <code>https://www.rusprofile.ru/id/1247700014870</code>, тип <code>registry</code>.</li>
              <li>Создать сущность-компанию: type=<code>company</code>, value=<code>ООО "Бизнес - Недвижимость"</code>.</li>
              <li>Создать сущность-физлицо: type=<code>person</code>, value=<code>Иванова Ольга Александровна</code>.</li>
              <li>Наблюдения по компании: ИНН, ОГРН, адрес, вид деятельности. Привязать источник.</li>
              <li>Связь: <code>Иванова --director_of--&gt; ООО</code>, статус <code>confirmed</code>.</li>
              <li>Если известна дата назначения — заполнить <code>valid_from</code>.</li>
            </ol>
            <p className="mt-2"><b>В графе получится:</b> узел компании, узел человека, направленное ребро «директор». От компании тянется цепочка наблюдений (ИНН, адрес — если адрес оформлен как сущность, то отдельный узел).</p>
          </Panel>

          <Panel header="ИП и его физлицо (один ИНН)" className="mb-3">
            <p><b>Задача:</b> связать ИП с физлицом, у которого тот же ИНН.</p>
            <ol className="pl-4">
              <li>Создать сущность ИП: type=<code>entrepreneur</code>, value=<code>ИП Иванова Ольга Александровна</code>.</li>
              <li>Создать сущность физлицо: type=<code>person</code>, value=<code>Иванова Ольга Александровна</code>.</li>
              <li>Связь: <code>person --individual_entrepreneur_of--&gt; entrepreneur</code>, статус <code>confirmed</code>, уверенность 100 (ИНН совпадает).</li>
              <li>В <code>evidence_text</code> написать: «Совпадение ИНН 773802621594».</li>
            </ol>
            <p className="mt-2"><b>В графе:</b> два узла с ребром «ИП того же лица». Полезно для склейки данных из разных источников.</p>
          </Panel>

          <Panel header="Цепочка аффилированности" className="mb-3">
            <p><b>Задача:</b> показать связь между двумя далёкими компаниями через общих учредителей.</p>
            <ol className="pl-4">
              <li>Завести оба ЮЛ как сущности.</li>
              <li>Завести всех учредителей как сущности <code>person</code> или <code>company</code>.</li>
              <li>Связи <code>founder_of</code> от каждого учредителя к каждой компании.</li>
              <li>Если у обоих ЮЛ один и тот же адрес — создать сущность <code>address</code> и связи <code>located_at</code> от каждой компании к адресу.</li>
              <li>Позже при визуализации графа это даст «мост» между двумя кластерами.</li>
            </ol>
          </Panel>

          <Panel header="Цепочка через домен и email" className="mb-3">
            <p><b>Задача:</b> показать связь между компанией и человеком через корпоративную почту.</p>
            <ol className="pl-4">
              <li>Сущность <code>company</code>.</li>
              <li>Сущность <code>domain</code> — например, <code>example.org</code>.</li>
              <li>Сущность <code>person</code>.</li>
              <li>Сущность <code>email</code> — <code>ivanov@example.org</code>.</li>
              <li>Связь: <code>company --uses_domain--&gt; domain</code>.</li>
              <li>Наблюдение: у <code>person</code> атрибут <code>email</code> = <code>ivanov@example.org</code>.</li>
              <li>Опционально: <code>person --associated_with--&gt; company</code> со статусом <code>hypothesis</code>, <code>evidence_text</code>: «почта на корпоративном домене».</li>
            </ol>
            <p className="mt-2"><b>В графе:</b> домен — общий узел, к которому тянутся и компания, и e-mail человека. Раскрытие домена покажет всех, кто с ним связан.</p>
          </Panel>

          <Panel header="Адрес как точка сбора" className="mb-3">
            <p><b>Задача:</b> найти «соседей» компании — другие ЮЛ по тому же адресу.</p>
            <ol className="pl-4">
              <li>Сущность <code>address</code> — «117312, город Москва, ул. Вавилова, д.19».</li>
              <li>Связь <code>located_at</code> от каждой компании по этому адресу к сущности-адресу.</li>
              <li>В диалоге адреса появится список всех компаний по нему.</li>
            </ol>
            <p className="mt-2"><b>В графе:</b> адрес — хаб, от него идут рёбра к десяткам компаний. Классический приём массового поиска аффилированности.</p>
          </Panel>

          <Panel header="Филиалы и дочерние" className="mb-3">
            <p><b>Задача:</b> отразить холдинговую структуру.</p>
            <ol className="pl-4">
              <li>Головная компания — сущность <code>company</code>.</li>
              <li>Дочерние — тоже сущности <code>company</code>.</li>
              <li>Связи <code>includes</code> от материнской к дочерним.</li>
              <li>Связи <code>founder_of</code> от материнской к дочерним (если она учредитель).</li>
              <li>Если у дочерних разные юр.адреса — создайте сущности <code>address</code> и связи <code>located_at</code>.</li>
            </ol>
            <p className="mt-2">После визуализации получится «дерево холдинга» с адресами на листьях.</p>
          </Panel>

          <Panel header="Массовый импорт (когда появится)">
            <p className="text-500">
              В будущем планируется импорт записей из внешних источников (CSV,
              JSON от парсеров, плагины). Тогда в этом разделе появится
              инструкция по массовому созданию связей и наблюдений из одного
              файла.
            </p>
          </Panel>
        </TabPanel>
      </TabView>
    </Dialog>
  );
};