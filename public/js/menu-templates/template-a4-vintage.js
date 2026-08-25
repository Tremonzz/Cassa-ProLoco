/**
 * Template: A4 Vintage
 * Formato: A4 Verticale
 */
(function () {
    if (typeof registerMenuTemplate !== 'function') {
        console.error("registerMenuTemplate not defined. Make sure menu-printer.js is loaded first.");
        return;
    }

    registerMenuTemplate({
        id: 'a4_vintage',
        name: 'A4 Vintage',
        description: 'Stile vintage ed elegante con sottile doppia linea bordeaux, 4 angoli decorati e font classici',
        pageSize: 'A4 portrait',
        render: function (data) {
            const eventName = data.eventName || 'Menu Evento';
            const topLabel = data.topLabel || 'MENU EVENTO';
            const notes = (data.notes || '').trim();
            const density = data.density || 'normal';

            const excludedCats = new Set((data.excludedCategoryIds || []).map(String));
            const excludedProds = new Set((data.excludedProductIds || []).map(String));

            const rawCategories = data.categories || [];
            const categories = rawCategories
                .filter(cat => !excludedCats.has(String(cat.id)))
                .map(cat => {
                    const validProducts = (cat.products || []).filter(p => !excludedProds.has(String(p.id)));
                    return { ...cat, products: validProducts };
                })
                .filter(cat => cat.products.length > 0);

            const categoriesHtml = categories.map(cat => {
                const productsHtml = cat.products.map(p => `
                    <div class="vintage-item-row">
                        <span class="vintage-item-name">${escapeMenuHtml(p.name)}</span>
                        <span class="vintage-item-leader"></span>
                        <span class="vintage-item-price">€ ${Number(p.price || 0).toFixed(2)}</span>
                    </div>
                `).join('');

                return `
                    <div class="vintage-category-section">
                        <div class="vintage-category-header-wrap">
                            <div class="vintage-category-flourish">
                                <svg viewBox="0 0 160 16" width="130" height="12" fill="#581c2d" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M80 3 C85 7, 95 10, 110 10 L155 10 L155 11.5 L110 11.5 C95 11.5, 85 14, 80 16 C75 14, 65 11.5, 50 11.5 L5 11.5 L5 10 L50 10 C65 10, 75 7, 80 3 Z"/>
                                    <circle cx="80" cy="9.5" r="2.5" fill="#581c2d"/>
                                    <circle cx="68" cy="9.5" r="1.5" fill="#581c2d"/>
                                    <circle cx="92" cy="9.5" r="1.5" fill="#581c2d"/>
                                </svg>
                            </div>
                            <h2 class="vintage-category-title">${escapeMenuHtml(cat.name)}</h2>
                            <div class="vintage-category-flourish" style="transform: scaleY(-1);">
                                <svg viewBox="0 0 160 16" width="130" height="12" fill="#581c2d" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M80 3 C85 7, 95 10, 110 10 L155 10 L155 11.5 L110 11.5 C95 11.5, 85 14, 80 16 C75 14, 65 11.5, 50 11.5 L5 11.5 L5 10 L50 10 C65 10, 75 7, 80 3 Z"/>
                                    <circle cx="80" cy="9.5" r="2.5" fill="#581c2d"/>
                                    <circle cx="68" cy="9.5" r="1.5" fill="#581c2d"/>
                                    <circle cx="92" cy="9.5" r="1.5" fill="#581c2d"/>
                                </svg>
                            </div>
                        </div>
                        <div class="vintage-category-items">
                            ${productsHtml}
                        </div>
                    </div>
                `;
            }).join('');

            const notesHtml = notes ? `
                <div class="vintage-footer-notes">
                    <p>${escapeMenuHtml(notes).replace(/\n/g, '<br>')}</p>
                </div>
            ` : '';

            // Density settings
            let bodyGap = '24px';
            let catTitleFontSize = '1.65rem';
            let itemFontSize = '1.5rem';
            let priceFontSize = '1.65rem';
            let itemGap = '11px';

            if (density === 'compact') {
                bodyGap = '16px';
                catTitleFontSize = '1.35rem';
                itemFontSize = '1.3rem';
                priceFontSize = '1.45rem';
                itemGap = '7px';
            } else if (density === 'spacious') {
                bodyGap = '30px';
                catTitleFontSize = '1.85rem';
                itemFontSize = '1.7rem';
                priceFontSize = '1.85rem';
                itemGap = '15px';
            }

            return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>${escapeMenuHtml(eventName)} - Menu</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,400;1,600&family=Cinzel:wght@600;700;800&display=swap" rel="stylesheet">
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
            color: #1a1615;
            font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
            line-height: 1.35;
            box-sizing: border-box;
        }

        .vintage-page-container {
            width: 100%;
            height: 100%;
            min-height: 100%;
            margin: 0 auto;
            position: relative;
            background: #ffffff;
            overflow: hidden;
            box-sizing: border-box;
        }

        /* Clean 4-corner frame background */
        .vintage-bg-frame {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: fill;
            z-index: 1;
            pointer-events: none;
        }

        /* Content area safely inside the double border */
        .vintage-content-wrapper {
            position: relative;
            z-index: 2;
            padding: 7% 9% 6% 9%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            box-sizing: border-box;
        }

        /* Top Header */
        .vintage-header {
            text-align: center;
            padding-bottom: 12px;
            margin-bottom: 20px;
            border-bottom: 1.5px solid rgba(88, 28, 45, 0.25);
        }

        .vintage-top-label {
            font-family: 'Cinzel', serif;
            font-size: 1.35rem;
            font-weight: 800;
            color: #581c2d;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 4px;
            display: block;
        }

        .vintage-event-name {
            font-size: 2.7rem;
            font-weight: 900;
            color: #581c2d;
            letter-spacing: 1px;
            text-transform: uppercase;
            line-height: 1.1;
        }

        /* Categories Section */
        .vintage-body-content {
            display: flex;
            flex-direction: column;
            gap: ${bodyGap};
            justify-content: flex-start;
            flex: 1;
        }

        .vintage-category-section {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .vintage-category-header-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
            text-align: center;
            gap: 4px;
        }

        .vintage-category-title {
            font-family: 'Cinzel', serif;
            font-size: ${catTitleFontSize};
            font-weight: 800;
            color: #581c2d;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            margin: 0;
            padding: 0 10px;
        }

        .vintage-category-flourish {
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.85;
        }

        .vintage-category-items {
            display: flex;
            flex-direction: column;
            gap: ${itemGap};
            padding: 0 10px;
        }

        .vintage-item-row {
            display: flex;
            align-items: baseline;
            gap: 10px;
            font-size: ${itemFontSize};
        }

        .vintage-item-name {
            font-weight: 700;
            color: #1a1615;
            white-space: nowrap;
        }

        .vintage-item-leader {
            flex: 1;
            border-bottom: 2px dotted #8c6d75;
            margin: 0 6px;
            min-width: 20px;
            position: relative;
            top: -4px;
        }

        .vintage-item-price {
            font-family: 'Playfair Display', Georgia, serif;
            font-weight: 900;
            color: #581c2d;
            font-size: ${priceFontSize};
            white-space: nowrap;
        }

        .vintage-footer-notes {
            margin-top: auto;
            padding-top: 14px;
            border-top: 1.5px dashed rgba(88, 28, 45, 0.3);
            font-size: 0.95rem;
            color: #581c2d;
            font-style: italic;
            text-align: center;
            white-space: pre-line;
            line-height: 1.45;
        }
    </style>
</head>
<body>
    <div class="vintage-page-container">
        <img src="images/menu-templates/a4-vintage-bg.jpeg" alt="Cornice Vintage" class="vintage-bg-frame">
        <div class="vintage-content-wrapper">
            <div class="vintage-header">
                <span class="vintage-top-label">${escapeMenuHtml(topLabel)}</span>
                <h1 class="vintage-event-name">${escapeMenuHtml(eventName)}</h1>
            </div>

            <div class="vintage-body-content">
                ${categoriesHtml || '<div style="color:#8c6d75;text-align:center;padding:40px;">Nessun piatto selezionato</div>'}
                ${notesHtml}
            </div>
        </div>
    </div>
</body>
</html>
            `;
        }
    });
})();
