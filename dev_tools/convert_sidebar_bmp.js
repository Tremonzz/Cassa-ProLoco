const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const pngPath = path.join(__dirname, '..', 'public', 'images', 'installer_sidebar.png');
const bmpPath = path.join(__dirname, '..', 'public', 'images', 'installer_sidebar.bmp');

async function convertToBmp() {
    try {
        console.log('Converting installer_sidebar.png to 164x314 BMP for NSIS compatibility...');
        if (!fs.existsSync(pngPath)) {
            console.error('ERROR: installer_sidebar.png does not exist at:', pngPath);
            return;
        }

        // Convert PNG to 164x314 BMP flattening transparency with solid background
        await sharp(pngPath)
            .resize(164, 314, { fit: 'cover' })
            .flatten({ background: { r: 30, g: 42, b: 74 } }) // #1e2a4a dark navy background
            .toFile(bmpPath);

        console.log('SUCCESS: installer_sidebar.bmp created at:', bmpPath);
    } catch (err) {
        console.error('ERROR converting sidebar to BMP:', err);
    }
}

convertToBmp();
