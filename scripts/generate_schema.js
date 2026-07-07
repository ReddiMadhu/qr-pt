/**
 * generate_schema.js
 * 
 * Reads the sample CSV file and generates a schema.json that describes:
 *   - expected column names
 *   - expected number of columns
 *   - inferred data type per column (string | number)
 * 
 * Usage:  node scripts/generate_schema.js
 * Output: public/sample/schema.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ────────────────────────────────────────────────────────────────────
const SAMPLE_CSV = path.resolve(__dirname, '..', 'public', 'sample', 'Property_data_sample.csv');
const OUTPUT_JSON = path.resolve(__dirname, '..', 'public', 'sample', 'schema.json');

// ── CSV parser (handles quoted fields with commas) ───────────────────────────
function parseCSV(text) {
    const rows = [];
    let curVal = '';
    let inQuotes = false;
    let row = [];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    curVal += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                curVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(curVal.trim());
                curVal = '';
            } else if (char === '\r') {
                // skip
            } else if (char === '\n') {
                row.push(curVal.trim());
                if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
                    rows.push(row);
                }
                row = [];
                curVal = '';
            } else {
                curVal += char;
            }
        }
    }
    row.push(curVal.trim());
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
        rows.push(row);
    }
    return rows;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const raw = fs.readFileSync(SAMPLE_CSV, 'utf-8');
const parsed = parseCSV(raw);

if (parsed.length < 2) {
    console.error('Sample CSV must have a header row and at least one data row.');
    process.exit(1);
}

const headers = parsed[0];
const dataRows = parsed.slice(1);

// Infer type per column by checking all data rows
const columns = headers.map((name, colIdx) => {
    const values = dataRows
        .map(r => r[colIdx] ?? '')
        .filter(v => v !== '');             // ignore blanks for type detection

    let inferredType = 'string';
    if (values.length > 0) {
        const numericCount = values.filter(v => !isNaN(Number(v))).length;
        if (numericCount / values.length > 0.5) {
            // Check if all numeric values are integers
            const allIntegers = values
                .filter(v => !isNaN(Number(v)))
                .every(v => Number.isInteger(Number(v)));
            inferredType = allIntegers ? 'integer' : 'number';
        }
    }

    return { name, type: inferredType, index: colIdx };
});

const schema = {
    _generated: new Date().toISOString(),
    _source: 'Property_data_sample.csv',
    expectedColumnCount: headers.length,
    columns,
};

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(schema, null, 2), 'utf-8');

console.log(`✅  Schema generated → ${OUTPUT_JSON}`);
console.log(`    Columns: ${headers.length}`);
columns.forEach(c => console.log(`      [${c.index}] ${c.name}  →  ${c.type}`));
