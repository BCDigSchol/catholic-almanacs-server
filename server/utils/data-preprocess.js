const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function preprocessCSV(filePath) {
    const data = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            data.push(row); // like append() in Python
        })
        .on('end', () => {
        resolve();
        })
        .on('error', (error) => {
        reject(error);
        });
    });
    
    for (const row of data) {
        for (const key in row) {
          const originalKey = key;
          const cleanedKey = key.replace(/^\ufeff/, '');
          if (cleanedKey !== originalKey) {
            row[cleanedKey] = row[key];
            delete row[key];
          }
          row[cleanedKey] = row[cleanedKey].replace(/^\ufeff/, '');
        }
    
        if (row['year']) {
          row['instYear'] = parseInt(row['year']);
          row['persYear'] = parseInt(row['year']);
          row['attendingInstYear'] = parseInt(row['year']);
          delete row['year'];
        }

        if (row['instID'] && row['instYear']) {
          row['uniqueInstID'] = `${row['instYear']}_${row['instID']}`;
        } else {
          row['uniqueInstID'] = '';
        }

        if (row['attendingInstID'] && row['attendingInstYear']) {
          row['uniqueAttendingInstID'] = `${row['attendingInstYear']}_${row['attendingInstID']}`;
        } else {
          row['uniqueAttendingInstID'] = '';
        }

        if (row['persID'] && row['persID'].startsWith('‒')) {
          row['persID'] = row['persID'].substring(1);
        }

        if (row['persName'] && row['persName'].startsWith('‒ ')) {
          row['persName'] = row['persName'].substring(2);
        }

        if (row['persID'] && row['persYear']) {
          row['uniquePersID'] = `${row['persYear']}_${row['persID']}`;
        }

        if ('longitude' in row) {
          if (row['longitude'] === "" || isNaN(Number(row['longitude']))) {
            row['longitude'] = null;
          } else {
            row['longitude'] = Number(row['longitude']);
          }
        }
        if ('latitude' in row) {
          if (row['latitude'] === "" || isNaN(Number(row['latitude']))) {
            row['latitude'] = null;
          } else {
            row['latitude'] = Number(row['latitude']);
          }
        }

        /**
         * Combine 'persSuffix' and 'affiliated' into 'religiousOrder' for filtering purposes
         */
        const suffix = row['persSuffix'] || '';
        const affiliated = row['affiliated'] || '';
        if (suffix && affiliated) {
          row['religiousOrder'] = `${suffix} ${affiliated}`.trim();
        } else if (suffix) {
          row['religiousOrder'] = suffix;
        } else if (affiliated) {
          row['religiousOrder'] = affiliated;
        } else {
          row['religiousOrder'] = '';
        }
    };

    const groupedData = {};
    for (const row of data) {
      const key = row['instID'];
      if (!key) continue;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(row);
    }

    const mergedData = [];
    for (const key in groupedData) {
      const rows = groupedData[key];
      if (rows.length === 1) {
        mergedData.push(rows[0]);
        continue;
      }
      const memberTypes = [];
      const members = [];
      for (const r of rows) {
        if (r.memberType && !memberTypes.includes(r.memberType)) {
          memberTypes.push(r.memberType);
        };
        if (r.member && !members.includes(r.member)) {
          members.push(r.member);
        }
      }
      rows[0].memberType = memberTypes.join(', ');
      rows[0].member = members.join(', ');
      mergedData.push(rows[0]);
    }

    return mergedData;
}

async function loadData(directoryPath) {
  let csvFilePath;
  if (process.env.NODE_ENV === 'test') {
    csvFilePath = path.join(directoryPath, 'import', 'test-data');
  }
  else {
    csvFilePath = path.join(directoryPath, 'import', 'data');
  }
  const files = fs.readdirSync(csvFilePath).filter(file => file.endsWith('.csv'));
  let data = [];
  for (const file of files) {
    const filePath = path.join(csvFilePath, file);
    data.push(await preprocessCSV(filePath));
  }
  return data;
}

module.exports = {
  preprocessCSV,
  loadData
};