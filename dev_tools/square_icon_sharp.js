const sharp = require('sharp');
const path = require('path');

const input = path.join(__dirname, '..', 'public', 'logo.png');
const output = path.join(__dirname, '..', 'public', 'icon.png');

sharp(input)
    .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toFile(output)
    .then(info => { console.log('Icon created:', info); })
    .catch(err => { console.error('Error:', err); });
