const fs = require('fs');
const path = require('path');

const clipsDir = path.join(__dirname, 'clips');
const outputFile = path.join(__dirname, 'clips.json');

const files = fs.readdirSync(clipsDir).filter(file => {
  return file.endsWith('.mp4') || file.endsWith('.webm');
});

const manifest = files.map(file => ({
  title: file.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
  url: `./clips/${file}`
}));

fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));
console.log(`Updated clips.json with ${manifest.length} videos!`);