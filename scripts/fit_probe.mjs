import fs from 'fs';
import FitParser from 'fit-file-parser';

const path = process.argv[2];
const buf = fs.readFileSync(path);

const parser = new FitParser({
  force: true,
  speedUnit: 'km/h',
  lengthUnit: 'm',
  temperatureUnit: 'celsius',
  elapsedRecordField: true,
  mode: 'list',
});

parser.parse(buf, (err, data) => {
  if (err) {
    console.error('ERROR', err);
    process.exit(1);
  }

  console.log('=== file_id ===');
  console.log(JSON.stringify(data.file_id, null, 2));

  console.log('=== session (первый) ===');
  console.log(JSON.stringify(data.sessions?.[0], null, 2));

  console.log('=== activity (первый) ===');
  console.log(JSON.stringify(data.activity?.[0], null, 2));

  console.log('=== records: total =', data.records?.length);
  if (data.records?.length) {
    console.log('=== record[0] ===');
    console.log(JSON.stringify(data.records[0], null, 2));
    console.log('=== record[10] ===');
    console.log(JSON.stringify(data.records[10], null, 2));
    console.log('=== record[middle] ===');
    console.log(JSON.stringify(data.records[Math.floor(data.records.length / 2)], null, 2));
    console.log('=== record[last] ===');
    console.log(JSON.stringify(data.records[data.records.length - 1], null, 2));

    const keys = new Set();
    for (const r of data.records) {
      for (const k of Object.keys(r)) keys.add(k);
    }
    console.log('=== все ключи в records ===');
    console.log([...keys].sort().join(', '));
  }

  console.log('=== laps total =', data.laps?.length);
  if (data.laps?.length) {
    console.log('=== lap[0] ===');
    console.log(JSON.stringify(data.laps[0], null, 2));
  }
});
