const fs = require('fs');
const path = require('path');

function getLatestCoberturaXml(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = [];
  function walk(current) {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.name.endsWith('.cobertura.xml') || item.name === 'coverage.cobertura.xml') {
        files.push(full);
      }
    }
  }
  walk(dir);
  if (files.length === 0) return null;
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

function parseCobertura(xmlPath) {
  const content = fs.readFileSync(xmlPath, 'utf8');
  const match = content.match(/<coverage[^>]*line-rate="([^"]+)"[^>]*branch-rate="([^"]+)"/);
  if (!match) return null;
  const lineRate = parseFloat(match[1]) * 100;
  const branchRate = parseFloat(match[2]) * 100;

  // Extract packages
  const packages = [];
  const packageRegex = /<package[^>]*name="([^"]+)"[^>]*line-rate="([^"]+)"/g;
  let pMatch;
  while ((pMatch = packageRegex.exec(content)) !== null) {
    packages.push({
      name: pMatch[1],
      lineRate: parseFloat(pMatch[2]) * 100
    });
  }

  // Extract classes
  const classes = [];
  const classRegex = /<class[^>]*name="([^"]+)"[^>]*filename="([^"]+)"[^>]*line-rate="([^"]+)"/g;
  let cMatch;
  while ((cMatch = classRegex.exec(content)) !== null) {
    classes.push({
      name: cMatch[1],
      filename: cMatch[2],
      lineRate: parseFloat(cMatch[3]) * 100
    });
  }

  return { lineRate, branchRate, packages, classes, xmlPath };
}

console.log('=== Backend Coverage Summary ===');
const backendXml = getLatestCoberturaXml(path.join(__dirname, '../backend/tests/FluentTindahan.UnitTests/TestResults'));
if (backendXml) {
  const res = parseCobertura(backendXml);
  console.log(`Report: ${res.xmlPath}`);
  console.log(`TOTAL Line Coverage: ${res.lineRate.toFixed(2)}%`);
  console.log(`TOTAL Branch Coverage: ${res.branchRate.toFixed(2)}%\n`);

  console.log('--- Packages ---');
  for (const pkg of res.packages) {
    console.log(`  ${pkg.name}: ${pkg.lineRate.toFixed(1)}%`);
  }

  console.log('\n--- Uncovered / Low-coverage Classes (<80%) ---');
  for (const cls of res.classes.filter(c => c.lineRate < 80)) {
    console.log(`  [${cls.lineRate.toFixed(1)}%] ${cls.name}`);
  }
} else {
  console.log('No backend coverage XML found yet.');
}
