#!/usr/bin/env node
// Extracts the three player templates (scorm-api, quiz-player, quiz-player.css)
// from ../scorm-builder.html into the player/ folder.
// Re-run this any time scorm-builder.html changes.
//
//   node extract.js
//
// Output:
//   player/scorm-api.js
//   player/quiz-player.js
//   player/quiz-player.css

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'scorm-builder.html');
const OUT = path.join(__dirname, 'player');

function extractTemplate(html, id) {
  // <script type="text/plain" id="..."> ... </script>
  const re = new RegExp(
    '<script[^>]+id=["\']' + id + '["\'][^>]*>\\n?([\\s\\S]*?)\\n?</script>'
  );
  const m = html.match(re);
  if (!m) throw new Error('Template "' + id + '" not found in scorm-builder.html');
  return m[1];
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Could not find ' + SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const html = fs.readFileSync(SRC, 'utf8');

  const api    = extractTemplate(html, 'tpl-api');
  const player = extractTemplate(html, 'tpl-player');
  const css    = extractTemplate(html, 'tpl-css');

  fs.writeFileSync(path.join(OUT, 'scorm-api.js'),    api);
  fs.writeFileSync(path.join(OUT, 'quiz-player.js'),  player);
  fs.writeFileSync(path.join(OUT, 'quiz-player.css'), css);

  console.log('Extracted templates to ' + OUT);
  console.log('  scorm-api.js    (' + api.length    + ' chars)');
  console.log('  quiz-player.js  (' + player.length + ' chars)');
  console.log('  quiz-player.css (' + css.length    + ' chars)');
}

main();
