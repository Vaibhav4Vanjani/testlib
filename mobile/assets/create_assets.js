const fs = require('fs');
const path = require('path');

const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

const assetsDir = path.resolve(__dirname);

['icon.png', 'splash.png', 'adaptive-icon.png'].forEach((fileName) => {
  const filePath = path.join(assetsDir, fileName);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created asset: ${fileName}`);
});
