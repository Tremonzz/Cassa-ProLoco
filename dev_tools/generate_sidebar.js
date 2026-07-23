const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');
const outputPath = path.join(__dirname, '..', 'public', 'images', 'installer_sidebar.png');

async function createSidebar() {
    try {
        console.log('Generating custom NSIS installer sidebar image...');
        
        // Resize logo to fit nicely in 328px width sidebar
        const resizedLogo = await sharp(logoPath)
            .resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        // Create 328x628 dark navy background (#1e2a4a = RGB 30, 42, 74)
        await sharp({
            create: {
                width: 328,
                height: 628,
                channels: 4,
                background: { r: 30, g: 42, b: 74, alpha: 1 }
            }
        })
        .composite([
            {
                input: resizedLogo,
                top: 80,
                left: 54
            }
        ])
        .png()
        .toFile(outputPath);

        console.log('SUCCESS: Custom installer_sidebar.png created at:', outputPath);
    } catch (err) {
        console.error('ERROR creating installer sidebar:', err);
    }
}

createSidebar();
