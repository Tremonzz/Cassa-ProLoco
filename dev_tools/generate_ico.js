const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;
const fs = require('fs');
const path = require('path');

const inputPng = path.join(__dirname, '..', 'public', 'images', 'icon.png');
const outputIco = path.join(__dirname, '..', 'public', 'images', 'icon.ico');

console.log('Converting icon.png to multi-resolution icon.ico...');
pngToIco(inputPng)
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('SUCCESS: icon.ico created successfully!');
  })
  .catch(err => {
    console.error('ERROR creating icon.ico:', err);
  });
