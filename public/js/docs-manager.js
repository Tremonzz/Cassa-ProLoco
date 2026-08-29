/**
 * docs-manager.js
 * In-App Documentation Modal & Markdown Viewer for ProLoco Cassa
 */

(function () {
    let docsData = [];
    let activeChapterId = 'Home';
    let isDocsLoaded = false;

    /**
     * Open Documentation Modal
     */
    async function openDocsModal(initialChapter = 'Home') {
        const modal = document.getElementById('docs-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        modal.classList.add('visible');

        if (!isDocsLoaded || docsData.length === 0) {
            await loadDocsData();
        }

        renderDocsSidebar();
        selectDocsChapter(initialChapter || 'Home');

        const searchInput = document.getElementById('docs-search-input');
        if (searchInput) {
            searchInput.value = '';
            setTimeout(() => searchInput.focus(), 80);
        }
        const clearBtn = document.getElementById('docs-search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
    }

    /**
     * Close Documentation Modal
     */
    function closeDocsModal() {
        const modal = document.getElementById('docs-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('visible');
        }
    }

    /**
     * Fetch documentation list and contents from server
     */
    async function loadDocsData() {
        const contentBody = document.getElementById('docs-content-body');
        if (contentBody) {
            contentBody.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-light);">
                    <span class="material-symbols-rounded spin" style="font-size: 32px; color: var(--primary);">progress_activity</span>
                    <p style="margin-top: 12px; font-weight: 600;">Caricamento documentazione in corso...</p>
                </div>
            `;
        }

        try {
            const res = await fetch('/api/docs');
            const data = await res.json();
            if (data.success && Array.isArray(data.docs) && data.docs.length > 0) {
                docsData = data.docs;
                isDocsLoaded = true;
            } else {
                throw new Error("Nessun capitolo trovato");
            }
        } catch (err) {
            console.error("Errore caricamento documentazione:", err);
            if (contentBody) {
                contentBody.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--danger-text, #ef4444);">
                        <span class="material-symbols-rounded" style="font-size: 40px;">error</span>
                        <p style="margin-top: 10px; font-weight: 700;">Impossibile caricare la documentazione.</p>
                        <p style="font-size: 0.85rem; color: var(--text-light);">Verifica che la cartella docs/wiki/ sia presente sul server.</p>
                    </div>
                `;
            }
        }
    }

    /**
     * Render sidebar list of chapters
     */
    function renderDocsSidebar() {
        const nav = document.getElementById('docs-sidebar-nav');
        if (!nav) return;

        if (docsData.length === 0) {
            nav.innerHTML = '<div style="padding: 12px; color: var(--text-light); font-size: 0.85rem;">Nessun capitolo</div>';
            return;
        }

        nav.innerHTML = docsData.map(doc => {
            const isActive = doc.id === activeChapterId;
            return `
                <button type="button" class="docs-nav-item ${isActive ? 'active' : ''}" 
                        onclick="selectDocsChapter('${escapeHtml(doc.id)}')"
                        data-chapter-id="${escapeHtml(doc.id)}">
                    <span class="material-symbols-rounded">${escapeHtml(doc.icon || 'article')}</span>
                    <span>${escapeHtml(doc.title)}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * Select and display a chapter
     */
    function selectDocsChapter(chapterId) {
        if (!chapterId) chapterId = 'Home';
        activeChapterId = chapterId;

        // Update active class in sidebar
        const navItems = document.querySelectorAll('.docs-nav-item');
        navItems.forEach(btn => {
            if (btn.getAttribute('data-chapter-id') === chapterId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const doc = docsData.find(d => d.id === chapterId) || docsData[0];
        const contentContainer = document.getElementById('docs-content-container');
        const contentBody = document.getElementById('docs-content-body');
        if (!contentBody) return;

        if (!doc) {
            contentBody.innerHTML = '<p style="color: var(--text-light);">Seleziona un capitolo dalla barra laterale.</p>';
            return;
        }

        let html = parseMarkdownToHtml(doc.content);

        // Generate Custom Navigation Buttons Footer with Vector Icons
        const currentIndex = docsData.findIndex(d => d.id === doc.id);
        const prevDoc = currentIndex > 0 ? docsData[currentIndex - 1] : null;
        const nextDoc = currentIndex >= 0 && currentIndex < docsData.length - 1 ? docsData[currentIndex + 1] : null;

        html += `
            <div class="docs-nav-footer">
                ${prevDoc ? `
                    <button type="button" class="docs-btn-nav prev" onclick="selectDocsChapter('${escapeHtml(prevDoc.id)}')">
                        <span class="material-symbols-rounded">arrow_back</span>
                        <span class="docs-btn-nav-title">${escapeHtml(prevDoc.title)}</span>
                    </button>
                ` : `<div></div>`}

                ${nextDoc ? `
                    <button type="button" class="docs-btn-nav next" onclick="selectDocsChapter('${escapeHtml(nextDoc.id)}')">
                        <span class="docs-btn-nav-title">${escapeHtml(nextDoc.title)}</span>
                        <span class="material-symbols-rounded">arrow_forward</span>
                    </button>
                ` : `<div></div>`}
            </div>
        `;

        contentBody.innerHTML = html;

        if (contentContainer) {
            contentContainer.scrollTop = 0;
        }
    }

    /**
     * Handle Live Search
     */
    function handleDocsSearch(query) {
        const cleanQuery = (query || '').trim();
        const clearBtn = document.getElementById('docs-search-clear-btn');
        if (clearBtn) {
            clearBtn.style.display = cleanQuery ? 'flex' : 'none';
        }

        const contentBody = document.getElementById('docs-content-body');
        if (!contentBody) return;

        if (!cleanQuery) {
            selectDocsChapter(activeChapterId);
            return;
        }

        const qLower = cleanQuery.toLowerCase();
        const results = [];

        docsData.forEach(doc => {
            const titleMatches = doc.title.toLowerCase().includes(qLower);
            const contentMatches = doc.content.toLowerCase().includes(qLower);

            if (titleMatches || contentMatches) {
                // Find matching snippets
                const paragraphs = doc.content.split(/\n\n+/);
                const matchedSnippets = [];

                paragraphs.forEach(p => {
                    if (p.toLowerCase().includes(qLower)) {
                        matchedSnippets.push(p.trim());
                    }
                });

                results.push({
                    doc,
                    snippets: matchedSnippets.slice(0, 3)
                });
            }
        });

        if (results.length === 0) {
            contentBody.innerHTML = `
                <div style="text-align: center; padding: 50px 20px; color: var(--text-light);">
                    <span class="material-symbols-rounded" style="font-size: 40px; color: var(--text-light);">search_off</span>
                    <h3 style="margin-top: 12px; font-weight: 700; color: var(--text-main);">Nessun risultato trovato</h3>
                    <p style="font-size: 0.9rem;">Nessun capitolo contiene il testo "<strong>${escapeHtml(cleanQuery)}</strong>". Prova con altri termini (es. <em>resto, scorte, scontrino, backup</em>).</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="margin-bottom: 20px;">
                <h2 style="margin: 0 0 4px 0; font-size: 1.25rem;">Risultati ricerca per "${escapeHtml(cleanQuery)}"</h2>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-light);">${results.length} capitoli corrispondenti</p>
            </div>
        `;

        results.forEach(res => {
            const d = res.doc;
            let snippetHtml = '';
            if (res.snippets.length > 0) {
                snippetHtml = res.snippets.map(snip => {
                    const parsed = parseMarkdownToHtml(snip);
                    return `<div style="font-size: 0.88rem; color: var(--text-main); margin-top: 6px; padding-left: 8px; border-left: 2px solid var(--primary);">${highlightText(parsed, cleanQuery)}</div>`;
                }).join('');
            }

            html += `
                <div class="docs-search-match-card" onclick="openDocsChapterFromSearch('${escapeHtml(d.id)}')">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span class="material-symbols-rounded" style="font-size: 20px; color: var(--primary);">${escapeHtml(d.icon || 'article')}</span>
                        <strong style="font-size: 1rem; color: var(--primary);">${highlightText(escapeHtml(d.title), cleanQuery)}</strong>
                    </div>
                    ${snippetHtml}
                </div>
            `;
        });

        contentBody.innerHTML = html;
    }

    function openDocsChapterFromSearch(chapterId) {
        const searchInput = document.getElementById('docs-search-input');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('docs-search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        selectDocsChapter(chapterId);
    }

    function clearDocsSearch() {
        const searchInput = document.getElementById('docs-search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        const clearBtn = document.getElementById('docs-search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        selectDocsChapter(activeChapterId);
    }

    function highlightText(htmlText, query) {
        if (!query) return htmlText;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return htmlText.replace(regex, '<mark class="docs-highlight">$1</mark>');
    }

    /**
     * Markdown to HTML Parser
     */
    function parseMarkdownToHtml(md) {
        if (!md) return '';
        let lines = md.replace(/\r\n/g, '\n').split('\n');
        let html = '';
        let inList = false;
        let inOrderedList = false;
        let inTable = false;
        let tableRows = [];
        let inBlockquote = false;
        let blockquoteLines = [];

        function flushTable() {
            if (!inTable || tableRows.length === 0) return '';
            let tHtml = '<div class="docs-table-wrapper"><table>';
            let isHeader = true;

            tableRows.forEach(rowStr => {
                const cells = rowStr.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
                // Check if separator line like |---|---|
                const isSep = cells.every(c => /^:?-+:?$/.test(c));
                if (isSep) {
                    isHeader = false;
                    return;
                }

                if (isHeader) {
                    tHtml += '<thead><tr>';
                    cells.forEach(c => {
                        tHtml += `<th>${formatInlineMarkdown(c)}</th>`;
                    });
                    tHtml += '</tr></thead><tbody>';
                    isHeader = false;
                } else {
                    tHtml += '<tr>';
                    cells.forEach(c => {
                        tHtml += `<td>${formatInlineMarkdown(c)}</td>`;
                    });
                    tHtml += '</tr>';
                }
            });

            tHtml += '</tbody></table></div>';
            inTable = false;
            tableRows = [];
            return tHtml;
        }

        function flushLists() {
            let res = '';
            if (inList) {
                res += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                res += '</ol>';
                inOrderedList = false;
            }
            return res;
        }

        function flushBlockquote() {
            if (!inBlockquote || blockquoteLines.length === 0) return '';
            const bqLines = [...blockquoteLines];
            inBlockquote = false;
            blockquoteLines = [];
            
            let bqHtml = '';
            let bqInList = false;
            let bqInOl = false;

            for (let j = 0; j < bqLines.length; j++) {
                const trimmed = bqLines[j].trim();
                if (!trimmed) {
                    if (bqInList) { bqHtml += '</ul>'; bqInList = false; }
                    if (bqInOl) { bqHtml += '</ol>'; bqInOl = false; }
                    continue;
                }
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    if (!bqInList) { bqHtml += '<ul>'; bqInList = true; }
                    bqHtml += `<li>${formatInlineMarkdown(trimmed.substring(2))}</li>`;
                    continue;
                }
                const olM = trimmed.match(/^(\d+)\.\s+(.*)$/);
                if (olM) {
                    if (!bqInOl) { bqHtml += '<ol>'; bqInOl = true; }
                    bqHtml += `<li>${formatInlineMarkdown(olM[2])}</li>`;
                    continue;
                }
                if (bqInList) { bqHtml += '</ul>'; bqInList = false; }
                if (bqInOl) { bqHtml += '</ol>'; bqInOl = false; }
                bqHtml += `<p>${formatInlineMarkdown(trimmed)}</p>`;
            }

            if (bqInList) bqHtml += '</ul>';
            if (bqInOl) bqHtml += '</ol>';
            return `<blockquote>${bqHtml}</blockquote>`;
        }

        function flushAll() {
            let res = '';
            res += flushLists();
            res += flushTable();
            res += flushBlockquote();
            return res;
        }

        for (let i = 0; i < lines.length; i++) {
            let rawLine = lines[i];
            let line = rawLine.trim();

            // Blockquote line (starts with >)
            if (line.startsWith('>')) {
                html += flushLists();
                html += flushTable();
                inBlockquote = true;
                blockquoteLines.push(rawLine.replace(/^\s*>\s?/, ''));
                continue;
            } else if (inBlockquote) {
                html += flushBlockquote();
            }

            // Table line
            if (line.startsWith('|') && line.endsWith('|')) {
                html += flushLists();
                inTable = true;
                tableRows.push(line);
                continue;
            } else if (inTable) {
                html += flushTable();
            }

            // Blank line
            if (line === '') {
                html += flushLists();
                continue;
            }

            // Headings
            if (line.startsWith('#### ')) {
                html += flushLists();
                html += `<h4>${formatInlineMarkdown(line.substring(5))}</h4>`;
                continue;
            }
            if (line.startsWith('### ')) {
                html += flushLists();
                html += `<h3>${formatInlineMarkdown(line.substring(4))}</h3>`;
                continue;
            }
            if (line.startsWith('## ')) {
                html += flushLists();
                html += `<h2>${formatInlineMarkdown(line.substring(3))}</h2>`;
                continue;
            }
            if (line.startsWith('# ')) {
                html += flushLists();
                html += `<h1>${formatInlineMarkdown(line.substring(2))}</h1>`;
                continue;
            }

            // Horizontal Rule
            if (line === '---' || line === '***' || line === '___') {
                html += flushLists();
                html += '<hr>';
                continue;
            }

            // Bullet List
            if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) {
                    html += flushLists();
                    html += '<ul>';
                    inList = true;
                }
                html += `<li>${formatInlineMarkdown(line.substring(2))}</li>`;
                continue;
            }

            // Ordered List
            const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
            if (olMatch) {
                if (!inOrderedList) {
                    html += flushLists();
                    html += '<ol>';
                    inOrderedList = true;
                }
                html += `<li>${formatInlineMarkdown(olMatch[2])}</li>`;
                continue;
            }

            // Normal paragraph
            html += flushLists();
            html += `<p>${formatInlineMarkdown(line)}</p>`;
        }

        html += flushAll();

        return html;
    }

    /**
     * Format inline markdown (bold, italic, code/kbd, links)
     */
    function formatInlineMarkdown(str) {
        if (!str) return '';

        // Escape dangerous HTML except safe markdown tags we create
        let out = str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Inline Code / Kbd: `code`
        out = out.replace(/`([^`]+)`/g, '<span class="docs-kbd">$1</span>');

        // Bold: **text**
        out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Markdown Links: [Text](Target)
        out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, target) => {
            // Check if it's an internal chapter link (e.g. 1-Informazioni-Base, Home, etc.)
            const cleanTarget = target.trim();
            if (cleanTarget.startsWith('http://') || cleanTarget.startsWith('https://')) {
                return `<a href="${cleanTarget}" target="_blank" rel="noopener" class="docs-wiki-link">${label}</a>`;
            } else {
                return `<a href="javascript:void(0)" class="docs-wiki-link" onclick="selectDocsChapter('${escapeHtml(cleanTarget)}')">${label}</a>`;
            }
        });

        return out;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Expose globals for window & onclick events
    window.openDocsModal = openDocsModal;
    window.closeDocsModal = closeDocsModal;
    window.selectDocsChapter = selectDocsChapter;
    window.openDocsChapterFromSearch = openDocsChapterFromSearch;
    window.handleDocsSearch = handleDocsSearch;
    window.clearDocsSearch = clearDocsSearch;

    // Dismiss on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('docs-modal');
            if (modal && modal.classList.contains('visible')) {
                closeDocsModal();
            }
        }
    });

    // Dismiss on outside modal click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('docs-modal');
        if (modal && e.target === modal) {
            closeDocsModal();
        }
    });
})();
