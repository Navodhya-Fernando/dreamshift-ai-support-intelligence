import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbDir = path.join(__dirname, '../kb');

// Target outdated prices and their corrected values
const replacements = [
  // Package Prices
  { old: /AUD\s*750/g, new: 'AUD 1050' },
  { old: /AUD\s*800/g, new: 'AUD 1100' },
  { old: /AUD\s*1500/g, new: 'AUD 1800' },
  // Individual Service Prices
  { old: /AUD\s*400/g, new: 'AUD 500' },
  { old: /AUD\s*150/g, new: 'AUD 200' },
  { old: /AUD\s*350/g, new: 'AUD 500' }
];

function updatePrices() {
  const files = fs.readdirSync(kbDir).filter(file => file.endsWith('.md'));
  let updatedFiles = 0;

  for (const file of files) {
    const filePath = path.join(kbDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    for (const { old, new: replacement } of replacements) {
      if (old.test(content)) {
        content = content.replace(old, replacement);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated prices in: ${file}`);
      updatedFiles++;
    }
  }

  console.log(`\nDone! Fixed price discrepancies in ${updatedFiles} files.`);
  console.log('Remember to run "node scripts/ingest.mjs" to update the vector database.');
}

updatePrices();