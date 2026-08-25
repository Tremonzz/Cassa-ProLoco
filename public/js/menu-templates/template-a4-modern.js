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
            const topLabel = data.topLabel || 'MENU EVENTO';
            const logoUrl = data.logoUrl || 'images/logo.png';
            const showLogo = (data.showLogo !== false);
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

            const notesHtml = notes ? `
                <div class="menu-footer-notes">
                    <p>${escapeMenuHtml(notes).replace(/\n/g, '<br>')}</p>
                </div>
            ` : '';

            // Density multipliers
            let bodyGap = '22px';
            let catHeaderFontSize = '1.35rem';
            let itemFontSize = '1.45rem';
            let priceFontSize = '1.55rem';
            let itemGap = '10px';

            if (density === 'compact') {
                bodyGap = '14px';
                catHeaderFontSize = '1.15rem';
                itemFontSize = '1.25rem';
                priceFontSize = '1.35rem';
                itemGap = '6px';
            } else if (density === 'spacious') {
                bodyGap = '28px';
                catHeaderFontSize = '1.5rem';
                itemFontSize = '1.65rem';
                priceFontSize = '1.75rem';
                itemGap = '14px';
            }

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
            padding: 14px 16px;
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
            border: 3.5px solid #1e2a4a;
            border-radius: 4px;
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
            border-bottom: 3.5px solid #1e2a4a;
            margin: 0;
            padding: 0;
            background: #ffffff;
        }

        .menu-logo-box {
            display: ${showLogo ? 'flex' : 'none'};
            align-items: center;
            justify-content: center;
            padding: 16px 24px;
            border-right: 3.5px solid #1e2a4a;
            width: 170px;
            min-width: 170px;
        }

        .menu-logo-img {
            max-height: 84px;
            max-width: 130px;
            object-fit: contain;
        }

        .menu-title-box {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 18px 28px;
            gap: 2px;
        }

        .menu-top-title {
            font-size: 1.3rem;
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
            padding: 26px 30px;
            display: flex;
            flex-direction: column;
            gap: ${bodyGap};
            flex: 1;
        }

        .menu-category-section {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .menu-category-header {
            background: #1e2a4a;
            color: #ffffff;
            padding: 5px 16px;
            font-size: ${catHeaderFontSize};
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            border-radius: 5px;
            margin-bottom: ${itemGap};
            display: inline-block;
        }

        .menu-category-items {
            display: flex;
            flex-direction: column;
            gap: ${itemGap};
            padding: 0 4px;
        }

        .menu-item-row {
            display: flex;
            align-items: baseline;
            gap: 8px;
            font-size: ${itemFontSize};
        }

        .menu-item-name {
            font-weight: 600;
            color: #1e293b;
            white-space: nowrap;
        }

        .menu-item-leader {
            flex: 1;
            border-bottom: 2px dotted #94a3b8;
            margin: 0 4px;
            min-width: 20px;
            position: relative;
            top: -4px;
        }

        .menu-item-price {
            font-weight: 800;
            color: #0f172a;
            font-size: ${priceFontSize};
            white-space: nowrap;
        }

        .menu-footer-notes {
            margin-top: auto;
            padding-top: 14px;
            border-top: 1.5px dashed #cbd5e1;
            font-size: 0.95rem;
            color: #64748b;
            font-style: italic;
            text-align: center;
            white-space: pre-line;
            line-height: 1.45;
        }
    </style>
</head>
<body>
    <div class="menu-page-container">
        <div class="menu-top-header">
            <div class="menu-logo-box">
                <img src="${escapeMenuHtml(logoUrl)}" alt="Logo" class="menu-logo-img" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="menu-title-box">
                <span class="menu-top-title">${escapeMenuHtml(topLabel)}</span>
                <h1 class="menu-event-name">${escapeMenuHtml(eventName)}</h1>
            </div>
        </div>

        <div class="menu-body-content">
            ${categoriesHtml || '<div style="color:#94a3b8;text-align:center;padding:40px;">Nessun piatto selezionato</div>'}
            ${notesHtml}
        </div>
    </div>
</body>
</html>
            `;
        }
    });
})();
