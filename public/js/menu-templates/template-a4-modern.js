/**
 * Template: A4 Moderno
 * Formato: A4 Verticale
 */
(function () {
    if (typeof registerMenuTemplate !== 'function') {
        console.error("registerMenuTemplate not defined. Make sure menu-printer.js is loaded first.");
        return;
    }

    registerMenuTemplate({
        id: 'a4_modern',
        name: 'A4 Moderno',
        description: 'Layout moderno ed elegante per fogli A4 con box di categoria e prezzi allineati',
        pageSize: 'A4 portrait',
        render: function (data) {
            const eventName = data.eventName || 'Menu Evento';
            const logoUrl = data.logoUrl || 'images/logo.png';
            const categories = data.categories || [];

            const categoriesHtml = categories.map(cat => {
                const productsHtml = (cat.products || []).map(p => `
                    <div class="menu-item-row">
                        <span class="menu-item-name">${escapeMenuHtml(p.name)}</span>
                        <span class="menu-item-leader"></span>
                        <span class="menu-item-price">€ ${Number(p.price || 0).toFixed(2)}</span>
                    </div>
                `).join('');

                return `
                    <div class="menu-category-section">
                        <div class="menu-category-header">
                            <span>${escapeMenuHtml(cat.name)}</span>
                        </div>
                        <div class="menu-category-items">
                            ${productsHtml}
                        </div>
                    </div>
                `;
            }).join('');

            return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>${escapeMenuHtml(eventName)} - Menu</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.35;
            box-sizing: border-box;
        }

        .menu-page-container {
            width: 100%;
            height: 100%;
            min-height: 100%;
            border: 3px solid #1e2a4a;
            padding: 0;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            box-sizing: border-box;
        }

        /* Top Header - seamless connection with outer border */
        .menu-top-header {
            display: flex;
            align-items: stretch;
            border-bottom: 3px solid #1e2a4a;
            margin: 0;
            padding: 0;
            background: #ffffff;
        }

        .menu-logo-box {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px 24px;
            border-right: 3px solid #1e2a4a;
            width: 180px;
            min-width: 180px;
        }

        .menu-logo-img {
            max-height: 88px;
            max-width: 140px;
            object-fit: contain;
        }

        .menu-title-box {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 16px 28px;
            gap: 2px;
        }

        .menu-top-title {
            font-size: 1.35rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #1e2a4a;
        }

        .menu-event-name {
            font-size: 2.5rem;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.1;
        }

        /* Category & Content Section */
        .menu-body-content {
            padding: 28px 32px;
            display: flex;
            flex-direction: column;
            gap: 24px;
            justify-content: flex-start;
        }

        .menu-category-section {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 6px;
        }

        .menu-category-header {
            background: #1e2a4a;
            color: #ffffff;
            display: inline-block;
            padding: 7px 22px;
            border-radius: 4px;
            font-size: 1.45rem;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            text-transform: uppercase;
        }

        .menu-category-items {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 0 4px;
        }

        .menu-item-row {
            display: flex;
            align-items: baseline;
            gap: 10px;
            font-size: 1.55rem;
        }

        .menu-item-name {
            font-weight: 700;
            color: #0f172a;
            white-space: nowrap;
        }

        .menu-item-leader {
            flex: 1;
            border-bottom: 3px dotted #94a3b8;
            margin: 0 4px;
            min-width: 20px;
            position: relative;
            top: -4px;
        }

        .menu-item-price {
            font-weight: 800;
            color: #0f172a;
            font-size: 1.65rem;
            white-space: nowrap;
        }

        @media screen {
            body {
                background: #e2e8f0;
                padding: 20px;
            }
            .menu-page-container {
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            }
        }
    </style>
</head>
<body>
    <div class="menu-page-container">
        <div class="menu-top-header">
            <div class="menu-logo-box">
                <img src="${logoUrl}" alt="Logo" class="menu-logo-img">
            </div>
            <div class="menu-title-box">
                <span class="menu-top-title">MENU EVENTO</span>
                <h1 class="menu-event-name">${escapeMenuHtml(eventName)}</h1>
            </div>
        </div>

        <div class="menu-body-content">
            ${categoriesHtml}
        </div>
    </div>
</body>
</html>
            `;
        }
    });
})();
