/**
 * Reports & Analytics Manager
 * Handles global multi-event reporting and statistics visualization.
 * Strictly isolated from POS, cart and order logic.
 */

(function () {
    const currentYear = new Date().getFullYear();

    let reportsState = {
        activeTab: 'overview',
        overviewData: null,
        timelinePeriod: 'month',
        dateFilter: {
            preset: 'this_year',
            startDate: `${currentYear}-01-01`,
            endDate: `${currentYear}-12-31`,
            label: `Quest'anno (${currentYear})`
        },
        isLoading: false,
        lastUpdated: null
    };

    let eventsTableState = {
        sortKey: 'date',
        sortDirection: 'desc',
        rawList: [],
        filteredList: [],
        renderedCount: 0,
        pageSize: 10,
        isLoadingMore: false
    };

    let compareState = {
        event1Id: null,
        event2Id: 'none',
        event1Data: null,
        event2Data: null,
        isLoading: false
    };

    /**
     * Compute start date, end date and label for quick presets.
     */
    function computePresetDates(preset) {
        const now = new Date();
        const yyyy = now.getFullYear();

        if (preset === 'this_year') {
            return {
                start: `${yyyy}-01-01`,
                end: `${yyyy}-12-31`,
                label: `Quest'anno (${yyyy})`
            };
        } else if (preset === 'prev_year') {
            const prevY = yyyy - 1;
            return {
                start: `${prevY}-01-01`,
                end: `${prevY}-12-31`,
                label: `Anno ${prevY}`
            };
        } else if (preset === 'this_week') {
            const curr = new Date(now);
            const dayOfWeek = curr.getDay(); // 0 is Sunday
            const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
            const mon = new Date(curr);
            mon.setDate(curr.getDate() + diffToMon);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);

            const formatD = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            return {
                start: formatD(mon),
                end: formatD(sun),
                label: 'Questa Settimana'
            };
        } else if (preset === 'this_month') {
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const start = `${yyyy}-${mm}-01`;
            const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
            const end = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
            const monthName = now.toLocaleString('it-IT', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            return {
                start,
                end,
                label: `Mese Corrente (${capitalizedMonth})`
            };
        } else if (preset === 'prev_month') {
            const prevMonthDate = new Date(yyyy, now.getMonth() - 1, 1);
            const pY = prevMonthDate.getFullYear();
            const pM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
            const lastDay = new Date(pY, prevMonthDate.getMonth() + 1, 0).getDate();
            const start = `${pY}-${pM}-01`;
            const end = `${pY}-${pM}-${String(lastDay).padStart(2, '0')}`;
            const pMonthName = prevMonthDate.toLocaleString('it-IT', { month: 'long' });
            const capitalizedPMonth = pMonthName.charAt(0).toUpperCase() + pMonthName.slice(1);
            return {
                start,
                end,
                label: `Mese Scorso (${capitalizedPMonth})`
            };
        } else if (preset === 'last_30_days') {
            const past = new Date(now);
            past.setDate(past.getDate() - 30);
            const yyyyStart = past.getFullYear();
            const mmStart = String(past.getMonth() + 1).padStart(2, '0');
            const ddStart = String(past.getDate()).padStart(2, '0');
            const start = `${yyyyStart}-${mmStart}-${ddStart}`;

            const mmEnd = String(now.getMonth() + 1).padStart(2, '0');
            const ddEnd = String(now.getDate()).padStart(2, '0');
            const end = `${yyyy}-${mmEnd}-${ddEnd}`;
            return {
                start,
                end,
                label: 'Ultimi 30 giorni'
            };
        } else if (preset === 'last_3_months') {
            const past = new Date(now);
            past.setDate(past.getDate() - 90);
            const yyyyStart = past.getFullYear();
            const mmStart = String(past.getMonth() + 1).padStart(2, '0');
            const ddStart = String(past.getDate()).padStart(2, '0');
            const start = `${yyyyStart}-${mmStart}-${ddStart}`;

            const mmEnd = String(now.getMonth() + 1).padStart(2, '0');
            const ddEnd = String(now.getDate()).padStart(2, '0');
            const end = `${yyyy}-${mmEnd}-${ddEnd}`;
            return {
                start,
                end,
                label: 'Ultimi 3 mesi'
            };
        } else if (preset === 'last_6_months') {
            const past = new Date(now);
            past.setDate(past.getDate() - 180);
            const yyyyStart = past.getFullYear();
            const mmStart = String(past.getMonth() + 1).padStart(2, '0');
            const ddStart = String(past.getDate()).padStart(2, '0');
            const start = `${yyyyStart}-${mmStart}-${ddStart}`;

            const mmEnd = String(now.getMonth() + 1).padStart(2, '0');
            const ddEnd = String(now.getDate()).padStart(2, '0');
            const end = `${yyyy}-${mmEnd}-${ddEnd}`;
            return {
                start,
                end,
                label: 'Ultimi 6 mesi'
            };
        } else if (preset === 'all_time') {
            return {
                start: null,
                end: null,
                label: 'Tutto lo Storico'
            };
        }
        return { start: null, end: null, label: 'Personalizzato' };
    }

    /**
     * Hide 'Mese' button in chart timeframe selector if the range is within a single month.
     */
    function updateTimeframeSelectorVisibility() {
        const monthBtn = document.getElementById('rep-timeframe-btn-month');
        if (!monthBtn) return;

        const start = reportsState.dateFilter.startDate;
        const end = reportsState.dateFilter.endDate;

        let isSingleMonth = false;
        if (start && end) {
            const sParts = start.split('-').map(Number);
            const eParts = end.split('-').map(Number);
            if (sParts[0] === eParts[0] && sParts[1] === eParts[1]) {
                isSingleMonth = true;
            } else {
                const sDate = new Date(start + 'T00:00:00');
                const eDate = new Date(end + 'T00:00:00');
                const diffDays = Math.round((eDate - sDate) / (1000 * 60 * 60 * 24));
                if (diffDays <= 31) {
                    isSingleMonth = true;
                }
            }
        }

        if (isSingleMonth) {
            monthBtn.style.display = 'none';
            if (reportsState.timelinePeriod === 'month') {
                reportsState.timelinePeriod = 'day';
                const dayBtn = document.getElementById('rep-timeframe-btn-day');
                const weekBtn = document.getElementById('rep-timeframe-btn-week');
                if (dayBtn) dayBtn.classList.add('active');
                if (weekBtn) weekBtn.classList.remove('active');
                monthBtn.classList.remove('active');
            }
        } else {
            monthBtn.style.display = 'inline-block';
        }
    }

    /**
     * Update the Date Range filter button label in the header.
     */
    function updateDateFilterButtonLabel() {
        const btnText = document.getElementById('reports-daterange-btn-text');
        if (btnText) {
            btnText.innerText = reportsState.dateFilter.label || `Quest'anno (${currentYear})`;
        }
        updateTimeframeSelectorVisibility();
    }

    /**
     * Open Date Range Filter Modal.
     */
    function openReportsDateRangeModal() {
        const modal = document.getElementById('reports-daterange-modal');
        if (!modal) return;

        // Sync preset buttons active state
        const presetButtons = modal.querySelectorAll('.reports-preset-btn');
        presetButtons.forEach(btn => {
            if (btn.getAttribute('data-preset') === reportsState.dateFilter.preset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Sync input fields
        const startInput = document.getElementById('rep-filter-start-date');
        const endInput = document.getElementById('rep-filter-end-date');
        if (startInput) startInput.value = reportsState.dateFilter.startDate || '';
        if (endInput) endInput.value = reportsState.dateFilter.endDate || '';

        modal.style.display = 'flex';
    }

    /**
     * Close Date Range Filter Modal.
     */
    function closeReportsDateRangeModal() {
        const modal = document.getElementById('reports-daterange-modal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Select a preset in the date range modal.
     */
    function selectReportsPreset(preset) {
        const modal = document.getElementById('reports-daterange-modal');
        if (!modal) return;

        const presetButtons = modal.querySelectorAll('.reports-preset-btn');
        presetButtons.forEach(btn => {
            if (btn.getAttribute('data-preset') === preset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const computed = computePresetDates(preset);
        const startInput = document.getElementById('rep-filter-start-date');
        const endInput = document.getElementById('rep-filter-end-date');
        if (startInput) startInput.value = computed.start || '';
        if (endInput) endInput.value = computed.end || '';
    }

    /**
     * Triggered when custom date input values are manually modified.
     */
    function onCustomDateInputChanged() {
        const modal = document.getElementById('reports-daterange-modal');
        if (!modal) return;

        const presetButtons = modal.querySelectorAll('.reports-preset-btn');
        presetButtons.forEach(btn => btn.classList.remove('active'));
    }

    /**
     * Apply the selected Date Range Filter and reload data.
     */
    function applyReportsDateFilter() {
        const modal = document.getElementById('reports-daterange-modal');
        const startInput = document.getElementById('rep-filter-start-date');
        const endInput = document.getElementById('rep-filter-end-date');

        let activePreset = null;
        if (modal) {
            const activeBtn = modal.querySelector('.reports-preset-btn.active');
            if (activeBtn) activePreset = activeBtn.getAttribute('data-preset');
        }

        const startVal = startInput ? startInput.value.trim() : '';
        const endVal = endInput ? endInput.value.trim() : '';

        if (activePreset && activePreset !== 'custom') {
            const computed = computePresetDates(activePreset);
            reportsState.dateFilter.preset = activePreset;
            reportsState.dateFilter.startDate = computed.start;
            reportsState.dateFilter.endDate = computed.end;
            reportsState.dateFilter.label = computed.label;
        } else {
            // Custom Range
            if (startVal && endVal && startVal > endVal) {
                alert("La data di inizio non può essere successiva alla data di fine.");
                return;
            }

            reportsState.dateFilter.preset = 'custom';
            reportsState.dateFilter.startDate = startVal || null;
            reportsState.dateFilter.endDate = endVal || null;

            if (startVal && endVal) {
                const sParts = startVal.split('-');
                const eParts = endVal.split('-');
                reportsState.dateFilter.label = `${sParts[2]}/${sParts[1]}/${sParts[0]} - ${eParts[2]}/${eParts[1]}/${eParts[0]}`;
            } else if (startVal) {
                const sParts = startVal.split('-');
                reportsState.dateFilter.label = `Dal ${sParts[2]}/${sParts[1]}/${sParts[0]}`;
            } else if (endVal) {
                const eParts = endVal.split('-');
                reportsState.dateFilter.label = `Fino al ${eParts[2]}/${eParts[1]}/${eParts[0]}`;
            } else {
                reportsState.dateFilter.label = 'Tutto lo Storico';
            }
        }

        updateDateFilterButtonLabel();
        closeReportsDateRangeModal();
        loadReportsOverview();
        if (reportsState.activeTab === 'products') {
            loadProductsBreakdown();
        }
    }

    /**
     * Switch view to Reports and load overview data.
     */
    async function openReportsView() {
        if (typeof showView === 'function') {
            const ok = await showView('reports');
            if (ok) {
                updateDateFilterButtonLabel();
                switchReportsTab('overview');
                loadReportsOverview();
            }
        }
    }

    /**
     * Return to home / sagra selector view.
     */
    function closeReportsView() {
        if (typeof showView === 'function') {
            showView('login');
        }
    }

    /**
     * Switch active tab in the left sidebar.
     * @param {string} tabName
     */
    function switchReportsTab(tabName) {
        reportsState.activeTab = tabName;

        const navItems = document.querySelectorAll('.reports-nav-item');
        navItems.forEach(item => {
            const tab = item.getAttribute('data-tab');
            if (tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const sections = document.querySelectorAll('.reports-tab-section');
        sections.forEach(sec => {
            if (sec.id === `reports-tab-${tabName}`) {
                sec.style.display = 'flex';
            } else {
                sec.style.display = 'none';
            }
        });

        if ((tabName === 'overview' || tabName === 'events') && !reportsState.overviewData && !reportsState.isLoading) {
            loadReportsOverview();
        } else if (tabName === 'events' && reportsState.overviewData) {
            renderEventsTabSection(reportsState.overviewData.sagras);
        } else if (tabName === 'products') {
            loadProductsBreakdown();
        } else if (tabName === 'event-inspect') {
            initInspectEventTab();
        }
    }

    /**
     * Switch timeframe for the Sales Wave Chart (day, week, month).
     */
    function changeReportsTimelinePeriod(period) {
        reportsState.timelinePeriod = period;

        const buttons = document.querySelectorAll('.reports-timeframe-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-period') === period) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (reportsState.overviewData && reportsState.overviewData.timeline) {
            renderSalesWaveChart(reportsState.overviewData.timeline, period);
        }
    }

    /**
     * Fetch global overview statistics from backend with active date range filter.
     */
    async function loadReportsOverview() {
        if (reportsState.isLoading) return;
        reportsState.isLoading = true;

        showLoadingOverlay();

        try {
            let url = '/api/reports/overview';
            const params = new URLSearchParams();
            if (reportsState.dateFilter.startDate) params.append('start_date', reportsState.dateFilter.startDate);
            if (reportsState.dateFilter.endDate) params.append('end_date', reportsState.dateFilter.endDate);

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to load report data');
            }

            reportsState.overviewData = data;
            reportsState.lastUpdated = new Date();

            renderOverviewSection(data);
        } catch (err) {
            console.error('Error loading reports overview:', err);
            renderOverviewError(err.message);
        } finally {
            reportsState.isLoading = false;
            hideLoadingOverlay();
        }
    }

    /**
     * Helper to show loading overlay.
     */
    function showLoadingOverlay() {
        let overlay = document.getElementById('reports-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'reports-loading-overlay';
            overlay.className = 'reports-loading-overlay';
            overlay.innerHTML = `
                <div class="reports-loading-spinner"></div>
                <div style="font-weight: 600; font-size: 0.95rem;">Caricamento resoconti...</div>
            `;
            const mainView = document.getElementById('view-reports');
            if (mainView) mainView.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    /**
     * Helper to hide loading overlay.
     */
    function hideLoadingOverlay() {
        const overlay = document.getElementById('reports-loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * Escape HTML strings safely.
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Format currency amount in standard Italian locale.
     */
    function formatCurrency(amount) {
        const val = Number(amount) || 0;
        return `€\u00A0${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Show custom tooltip for reports wave chart.
     */
    function showReportsChartTooltip(e, timeLabel, revenueText, orderText) {
        const tooltip = document.getElementById('reports-chart-tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="reports-tooltip-time">${escapeHtml(timeLabel)}</div>
            <div class="reports-tooltip-val">
                <span class="material-symbols-rounded">payments</span>
                <span>${revenueText}</span>
            </div>
            <div class="reports-tooltip-sub">
                <span class="material-symbols-rounded" style="font-size:14px;">receipt_long</span>
                <span>${orderText}</span>
            </div>
        `;

        const dot = e.target;
        const parent = tooltip.offsetParent || tooltip.parentElement;
        if (dot && parent) {
            const dotRect = dot.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            const left = dotRect.left - parentRect.left + (dotRect.width / 2);
            const top = dotRect.top - parentRect.top - 8;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }

        tooltip.classList.add('visible');
    }

    /**
     * Hide custom tooltip for reports wave chart.
     */
    function hideReportsChartTooltip() {
        const tooltip = document.getElementById('reports-chart-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    }

    /**
     * Fill continuous date intervals (days, weeks, months) with 0 revenue where no sales occurred.
     */
    function fillContinuousTimeline(timelineRaw, period) {
        if (!timelineRaw || timelineRaw.length === 0) return [];
        if (timelineRaw.length === 1) return timelineRaw;

        const map = new Map();
        timelineRaw.forEach(item => {
            map.set(item.time_key, item);
        });

        if (period === 'day') {
            const sortedKeys = timelineRaw.map(t => t.time_key).sort();
            const first = new Date(sortedKeys[0] + 'T00:00:00');
            const last = new Date(sortedKeys[sortedKeys.length - 1] + 'T00:00:00');
            const result = [];

            const curr = new Date(first);
            while (curr <= last) {
                const yyyy = curr.getFullYear();
                const mm = String(curr.getMonth() + 1).padStart(2, '0');
                const dd = String(curr.getDate()).padStart(2, '0');
                const key = `${yyyy}-${mm}-${dd}`;

                if (map.has(key)) {
                    result.push(map.get(key));
                } else {
                    result.push({
                        time_key: key,
                        label: `${dd}/${mm}/${yyyy}`,
                        short_label: `${dd}/${mm}`,
                        orders_count: 0,
                        revenue: 0
                    });
                }
                curr.setDate(curr.getDate() + 1);
            }
            return result;
        } else if (period === 'month') {
            const sortedKeys = timelineRaw.map(t => t.time_key).sort();
            const [firstY, firstM] = sortedKeys[0].split('-').map(Number);
            const [lastY, lastM] = sortedKeys[sortedKeys.length - 1].split('-').map(Number);
            const result = [];

            let y = firstY;
            let m = firstM;
            while (y < lastY || (y === lastY && m <= lastM)) {
                const mm = String(m).padStart(2, '0');
                const key = `${y}-${mm}`;

                if (map.has(key)) {
                    result.push(map.get(key));
                } else {
                    result.push({
                        time_key: key,
                        label: `${mm}/${y}`,
                        short_label: `${mm}/${y}`,
                        orders_count: 0,
                        revenue: 0
                    });
                }

                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
            return result;
        } else if (period === 'week') {
            const sortedKeys = timelineRaw.map(t => t.time_key).sort();
            const firstKey = sortedKeys[0];
            const lastKey = sortedKeys[sortedKeys.length - 1];
            const [firstY, firstW] = firstKey.split('-W').map(Number);
            const [lastY, lastW] = lastKey.split('-W').map(Number);
            const result = [];

            let y = firstY;
            let w = firstW;
            while (y < lastY || (y === lastY && w <= lastW)) {
                const ww = String(w).padStart(2, '0');
                const key = `${y}-W${ww}`;

                if (map.has(key)) {
                    result.push(map.get(key));
                } else {
                    result.push({
                        time_key: key,
                        label: `Sett. ${ww} (${y})`,
                        short_label: `Sett. ${ww}`,
                        orders_count: 0,
                        revenue: 0
                    });
                }

                w++;
                if (w > 52) {
                    w = 0;
                    y++;
                }
            }
            return result;
        }

        return timelineRaw;
    }

    /**
     * Generate a monotone cubic spline SVG path that never undershoots or overshoots.
     * Prevents negative dips below the baseline when transitioning from 0 to positive sales.
     */
    function buildMonotoneSplinePath(points, baselineY) {
        const n = points.length;
        if (n === 0) return '';
        if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${(points[0].x + 1).toFixed(1)} ${points[0].y.toFixed(1)}`;

        // 1. Calculate secants (slopes between consecutive points)
        const dxs = [];
        const dys = [];
        const slopes = [];
        for (let i = 0; i < n - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            dxs.push(dx);
            dys.push(dy);
            slopes.push(dx !== 0 ? dy / dx : 0);
        }

        // 2. Calculate initial tangents
        const tangents = [slopes[0]];
        for (let i = 1; i < n - 1; i++) {
            if (slopes[i - 1] * slopes[i] <= 0) {
                // If slope changes sign or either is flat, clamp tangent to 0 (flat horizontal)
                tangents.push(0);
            } else {
                tangents.push((slopes[i - 1] + slopes[i]) / 2);
            }
        }
        tangents.push(slopes[n - 2]);

        // 3. Fritsch-Carlson monotonicity condition
        for (let i = 0; i < n - 1; i++) {
            if (dys[i] === 0) {
                tangents[i] = 0;
                tangents[i + 1] = 0;
            } else {
                const alpha = tangents[i] / slopes[i];
                const beta = tangents[i + 1] / slopes[i];
                const dist = alpha * alpha + beta * beta;
                if (dist > 9) {
                    const tau = 3 / Math.sqrt(dist);
                    tangents[i] = tau * alpha * slopes[i];
                    tangents[i + 1] = tau * beta * slopes[i];
                }
            }
        }

        // 4. Build cubic Bezier curve segments
        let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < n - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dx = dxs[i];

            const cp1x = p1.x + dx / 3;
            let cp1y = p1.y + (tangents[i] * dx) / 3;
            const cp2x = p2.x - dx / 3;
            let cp2y = p2.y - (tangents[i + 1] * dx) / 3;

            // Strict clamp: never dip below baseline (revenue >= 0)
            if (baselineY !== undefined) {
                cp1y = Math.min(cp1y, baselineY);
                cp2y = Math.min(cp2y, baselineY);
            }

            path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }

        return path;
    }

    /**
     * Render the Sales Wave Spline Area Chart.
     */
    function renderSalesWaveChart(timelineObj, period) {
        const container = document.getElementById('reports-sales-chart-container');
        if (!container) return;

        hideReportsChartTooltip();

        const rawTimeline = (timelineObj && timelineObj[period]) ? timelineObj[period] : [];
        const timeline = fillContinuousTimeline(rawTimeline, period);

        if (!timeline || timeline.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessuna vendita registrata nel periodo selezionato.</div>';
            return;
        }

        let maxRevenue = 0;
        let peakKey = '';
        timeline.forEach(slot => {
            const rev = Number(slot.revenue) || 0;
            if (rev > maxRevenue) {
                maxRevenue = rev;
                peakKey = slot.time_key;
            }
        });

        const svgWidth = 900;
        const svgHeight = 160;
        const paddingX = 45;
        const paddingTop = 25;
        const paddingBottom = 30;

        const count = timeline.length;
        const usableWidth = svgWidth - (paddingX * 2);
        const usableHeight = svgHeight - paddingTop - paddingBottom;

        const baselineY = svgHeight - paddingBottom;

        // Compute (x, y) coordinates
        const points = timeline.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const rev = Number(slot.revenue) || 0;
            const ratio = maxRevenue > 0 ? (rev / maxRevenue) : 0;
            const y = baselineY - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Build monotone cubic spline path (no negative dips below baseline)
        const linePath = buildMonotoneSplinePath(points, baselineY);

        const firstX = points[0].x;
        const lastX = points[points.length - 1].x;
        const bottomY = baselineY + 8;
        const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

        const dotsHtml = points.map(pt => {
            const rev = Number(pt.slot.revenue) || 0;
            if (rev <= 0) return ''; // Do not render dots on zero-sales days

            const isPeak = (pt.slot.time_key === peakKey && maxRevenue > 0);
            const revenueText = formatCurrency(rev);
            const orderText = pt.slot.orders_count === 1 ? '1 scontrino' : `${pt.slot.orders_count} scontrini`;
            const titleLabel = pt.slot.label || pt.slot.time_key;
            const leftPct = (pt.x / svgWidth * 100).toFixed(2);
            const topPct = (pt.y / svgHeight * 100).toFixed(2);

            return `
                <div class="reports-chart-point-dot ${isPeak ? 'peak-dot' : ''}" 
                     style="left: ${leftPct}%; top: ${topPct}%; background: var(--primary, #2563eb);"
                     onmouseenter="showReportsChartTooltip(event, '${escapeHtml(titleLabel)}', '${revenueText}', '${orderText}')"
                     onmouseleave="hideReportsChartTooltip()">
                </div>
            `;
        }).join('');

        // Step intervals for x-axis labels
        const maxLabels = 10;
        const step = Math.ceil(points.length / maxLabels);

        const labelsHtml = points.map((pt, idx) => {
            if (idx % step !== 0 && idx !== points.length - 1) return '';
            return `
                <span class="reports-wave-label" style="position: absolute; left: ${(pt.x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
                    ${escapeHtml(pt.slot.short_label || pt.slot.time_key)}
                </span>
            `;
        }).join('');

        container.innerHTML = `
            <svg class="reports-wave-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="reportsWaveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                    </linearGradient>
                </defs>
                <path class="reports-wave-area-path" d="${areaPath}" />
                <path class="reports-wave-line-path" d="${linePath}" />
            </svg>
            <div class="reports-wave-dots-wrap">
                ${dotsHtml}
            </div>
            <div class="reports-wave-labels-wrap">
                ${labelsHtml}
            </div>
        `;
    }

    /**
     * Render the Overview section: KPIs, charts, and breakdowns.
     */
    function renderOverviewSection(data) {
        const totals = data.totals || {};
        const sagras = data.sagras || [];
        const categoryBreakdown = data.categoryBreakdown || [];
        const timeline = data.timeline || {};

        // 1. KPI Cards
        const totalRevenueEl = document.getElementById('rep-kpi-total-revenue');
        if (totalRevenueEl) totalRevenueEl.innerText = formatCurrency(totals.totalRevenue);

        const totalOrdersEl = document.getElementById('rep-kpi-total-orders');
        if (totalOrdersEl) totalOrdersEl.innerText = (totals.totalOrders || 0).toLocaleString('it-IT');

        const avgOrderEl = document.getElementById('rep-kpi-avg-order');
        if (avgOrderEl) avgOrderEl.innerText = formatCurrency(totals.averageOrderValue);

        const totalSagrasEl = document.getElementById('rep-kpi-total-sagras');
        if (totalSagrasEl) totalSagrasEl.innerText = (totals.totalSagras || 0).toLocaleString('it-IT');

        const bestSellerNameEl = document.getElementById('rep-kpi-bestseller-name');
        const bestSellerQtyEl = document.getElementById('rep-kpi-bestseller-qty');
        if (totals.bestSeller) {
            if (bestSellerNameEl) bestSellerNameEl.innerText = totals.bestSeller.product_name;
            if (bestSellerQtyEl) bestSellerQtyEl.innerText = `${totals.bestSeller.total_qty} venduti (${formatCurrency(totals.bestSeller.total_revenue)})`;
        } else {
            if (bestSellerNameEl) bestSellerNameEl.innerText = 'Nessun piatto';
            if (bestSellerQtyEl) bestSellerQtyEl.innerText = '0 venduti';
        }

        // 2. Sales Timeline Wave Chart
        renderSalesWaveChart(timeline, reportsState.timelinePeriod);

        // 3. Sagras and Categories Comparisons
        renderSagrasRevenueChart(sagras, totals.totalRevenue);
        renderCategoryBreakdown(categoryBreakdown, totals.totalRevenue);

        // 4. Events Tab Section Table & Comparison
        renderEventsTabSection(sagras);
    }

    /**
     * Render Sagra revenue bar comparison.
     */
    function renderSagrasRevenueChart(sagras, totalRevenue) {
        const container = document.getElementById('rep-chart-sagras-bars');
        if (!container) return;

        if (!sagras || sagras.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessun evento registrato nel periodo</div>';
            return;
        }

        // 1. Sort all sagras descending by revenue
        const sorted = [...sagras].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0));

        // 2. Limit to top 5 and group the rest in a 6th "Altri" entry
        let displayList = sorted;
        if (sorted.length > 5) {
            const top5 = sorted.slice(0, 5);
            const remaining = sorted.slice(5);
            const othersRevenue = remaining.reduce((sum, s) => sum + (Number(s.revenue) || 0), 0);
            const othersOrders = remaining.reduce((sum, s) => sum + (Number(s.orders_count) || 0), 0);

            displayList = [
                ...top5,
                {
                    name: `Altri (${remaining.length} eventi)`,
                    revenue: othersRevenue,
                    orders_count: othersOrders,
                    isOther: true
                }
            ];
        }

        const barsHtml = displayList.map(s => {
            const rev = Number(s.revenue) || 0;
            const globalShare = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : '0.0';
            const percentage = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

            return `
                <div class="reports-progress-item">
                    <div class="reports-progress-header">
                        <span class="reports-progress-title" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                        <div class="reports-progress-values">
                            <span class="reports-progress-amount">${formatCurrency(rev)}</span>
                            <span class="reports-progress-sub">(${s.orders_count} ordini • ${globalShare}%)</span>
                        </div>
                    </div>
                    <div class="reports-progress-track">
                        <div class="reports-progress-fill" style="width: ${Math.max(percentage, rev > 0 ? 1 : 0)}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = barsHtml;
    }

    /**
     * Render Category Breakdown progress items.
     */
    function renderCategoryBreakdown(categories, totalRevenue) {
        const container = document.getElementById('rep-chart-categories-list');
        if (!container) return;

        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessun dato per categorie nel periodo</div>';
            return;
        }

        // Sort categories descending by revenue
        const sortedCategories = [...categories].sort((a, b) => (Number(b.total_revenue) || 0) - (Number(a.total_revenue) || 0));

        const html = sortedCategories.map(cat => {
            const rev = Number(cat.total_revenue) || 0;
            const share = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : '0.0';
            const percentage = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

            return `
                <div class="reports-progress-item">
                    <div class="reports-progress-header">
                        <span class="reports-progress-title" title="${escapeHtml(cat.category_name)}">${escapeHtml(cat.category_name)}</span>
                        <div class="reports-progress-values">
                            <span class="reports-progress-amount">${formatCurrency(rev)}</span>
                            <span class="reports-progress-sub">(${cat.total_qty.toLocaleString('it-IT')} pezzi • ${share}%)</span>
                        </div>
                    </div>
                    <div class="reports-progress-track">
                        <div class="reports-progress-fill" style="width: ${Math.max(percentage, rev > 0 ? 1 : 0)}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Helper to sort list of events based on column and direction.
     */
    function sortEventsList(list, key, direction) {
        return [...list].sort((a, b) => {
            let valA, valB;
            if (key === 'name') {
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
                return direction === 'asc' ? valA.localeCompare(valB, 'it') : valB.localeCompare(valA, 'it');
            } else if (key === 'date') {
                valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                if (valA === valB) {
                    valA = Number(a.id) || 0;
                    valB = Number(b.id) || 0;
                }
            } else if (key === 'orders') {
                valA = Number(a.orders_count) || 0;
                valB = Number(b.orders_count) || 0;
            } else if (key === 'revenue') {
                valA = Number(a.revenue) || 0;
                valB = Number(b.revenue) || 0;
            } else if (key === 'avg') {
                const ordersA = Number(a.orders_count) || 0;
                const ordersB = Number(b.orders_count) || 0;
                valA = ordersA > 0 ? (Number(a.revenue) || 0) / ordersA : 0;
                valB = ordersB > 0 ? (Number(b.revenue) || 0) / ordersB : 0;
            }
            return direction === 'asc' ? valA - valB : valB - valA;
        });
    }

    /**
     * Update sort arrow icons in table header.
     */
    function updateSortHeaderIcons() {
        const icons = document.querySelectorAll('.reports-sort-icon');
        icons.forEach(icon => {
            const key = icon.getAttribute('data-sort-icon');
            if (key === eventsTableState.sortKey) {
                icon.innerText = eventsTableState.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
                icon.classList.add('active');
            } else {
                icon.innerText = '';
                icon.classList.remove('active');
            }
        });
    }

    /**
     * Sort events table by a given column key.
     */
    function sortReportsEventsBy(key) {
        if (eventsTableState.sortKey === key) {
            eventsTableState.sortDirection = eventsTableState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            eventsTableState.sortKey = key;
            eventsTableState.sortDirection = (key === 'name' ? 'asc' : 'desc');
        }

        updateSortHeaderIcons();

        eventsTableState.filteredList = sortEventsList(eventsTableState.filteredList, eventsTableState.sortKey, eventsTableState.sortDirection);
        renderNextEventsChunk(true);

        const wrapper = document.getElementById('rep-events-table-wrapper');
        if (wrapper) wrapper.scrollTop = 0;
    }

    /**
     * Render the Dettaglio Eventi list section.
     */
    function renderEventsTabSection(sagras) {
        const list = sagras || [];
        eventsTableState.rawList = list;

        const searchInput = document.getElementById('rep-events-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        let filtered = list;
        if (query) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(query)));
        }

        eventsTableState.filteredList = sortEventsList(filtered, eventsTableState.sortKey, eventsTableState.sortDirection);

        const countBadge = document.getElementById('rep-events-count-badge');
        if (countBadge) {
            countBadge.innerText = `${eventsTableState.filteredList.length} ${eventsTableState.filteredList.length === 1 ? 'evento' : 'eventi'}`;
        }

        updateSortHeaderIcons();
        renderNextEventsChunk(true);

        // Populate custom comparison dropdowns
        populateCompareEventSelectors(list);
    }

    /**
     * Render a chunk of 10 events (or next 10 upon scrolling).
     */
    function renderNextEventsChunk(reset = false) {
        const tbody = document.getElementById('rep-events-tbody');
        if (!tbody) return;

        if (reset) {
            tbody.innerHTML = '';
            eventsTableState.renderedCount = 0;
        }

        const totalItems = eventsTableState.filteredList.length;
        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="reports-table-empty">Nessun evento registrato nel periodo selezionato.</td></tr>`;
            eventsTableState.renderedCount = 0;
            return;
        }

        if (eventsTableState.renderedCount >= totalItems) return;

        const nextChunk = eventsTableState.filteredList.slice(
            eventsTableState.renderedCount,
            eventsTableState.renderedCount + eventsTableState.pageSize
        );

        const rowsHtml = nextChunk.map((s, i) => {
            const globalIndex = eventsTableState.renderedCount + i + 1;
            const rev = Number(s.revenue) || 0;
            const orders = Number(s.orders_count) || 0;
            const avg = orders > 0 ? (rev / orders) : 0;
            const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: var(--text-light);">${globalIndex}</td>
                    <td>
                        <button type="button" class="reports-event-link-btn" onclick="openEventStatsModal(${s.id})" title="Apri statistiche evento">
                            <span class="material-symbols-rounded" style="font-size: 18px; color: var(--primary);">festival</span>
                            <span class="reports-event-name-text">${escapeHtml(s.name)}</span>
                        </button>
                    </td>
                    <td style="color: var(--text-light);">${dateStr}</td>
                    <td style="text-align: right; font-weight: 600;">${orders.toLocaleString('it-IT')}</td>
                    <td style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(rev)}</td>
                    <td style="text-align: right; color: var(--text-light);">${formatCurrency(avg)}</td>
                    <td style="text-align: center;">
                        <button type="button" class="reports-table-action-btn" onclick="openEventStatsModal(${s.id})" title="Visualizza statistiche complete">
                            <span class="material-symbols-rounded">bar_chart</span>
                            <span>Statistiche</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Remove previous status row if existing
        const prevStatusRow = tbody.querySelector('.reports-table-status-row');
        if (prevStatusRow) prevStatusRow.remove();

        if (reset) {
            tbody.innerHTML = rowsHtml;
        } else {
            tbody.insertAdjacentHTML('beforeend', rowsHtml);
        }

        eventsTableState.renderedCount += nextChunk.length;

        // Append 11th row for loading / end of list
        let statusRowHtml = '';
        if (eventsTableState.renderedCount < totalItems) {
            statusRowHtml = `
                <tr class="reports-table-status-row reports-table-more-row">
                    <td colspan="7">
                        <div class="reports-table-indicator-content">
                            <span class="material-symbols-rounded spin" style="font-size: 16px; color: var(--primary);">progress_activity</span>
                            <span>Scorri per caricare altri eventi (${eventsTableState.renderedCount} di ${totalItems} visualizzati)</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            statusRowHtml = `
                <tr class="reports-table-status-row reports-table-end-row">
                    <td colspan="7">
                        <div class="reports-table-indicator-content">
                            <span class="material-symbols-rounded" style="font-size: 16px; color: var(--primary);">check_circle</span>
                            <span>Fine elenco (${totalItems} ${totalItems === 1 ? 'evento' : 'eventi totali'})</span>
                        </div>
                    </td>
                </tr>
            `;
        }
        tbody.insertAdjacentHTML('beforeend', statusRowHtml);
    }

    /**
     * Infinite scroll event handler for the table wrapper.
     */
    function handleEventsTableScroll(container) {
        if (!container) return;
        if (eventsTableState.renderedCount >= eventsTableState.filteredList.length) return;
        if (eventsTableState.isLoadingMore) return;

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 30) {
            eventsTableState.isLoadingMore = true;
            renderNextEventsChunk(false);
            eventsTableState.isLoadingMore = false;
        }
    }

    /**
     * Filter events list by search query.
     */
    function filterReportsEventsList() {
        const searchInput = document.getElementById('rep-events-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const list = eventsTableState.rawList || [];

        let filtered = list;
        if (query) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(query)));
        }

        eventsTableState.filteredList = sortEventsList(filtered, eventsTableState.sortKey, eventsTableState.sortDirection);

        const countBadge = document.getElementById('rep-events-count-badge');
        if (countBadge) {
            countBadge.innerText = `${eventsTableState.filteredList.length} ${eventsTableState.filteredList.length === 1 ? 'evento' : 'eventi'}`;
        }

        renderNextEventsChunk(true);

        const wrapper = document.getElementById('rep-events-table-wrapper');
        if (wrapper) wrapper.scrollTop = 0;
    }

    /**
     * Populate Custom Dropdown Selectors for Event 1 and Event 2.
     */
    function populateCompareEventSelectors(sagras) {
        const list = sagras || [];

        if (list.length === 0) {
            const text1 = document.getElementById('rep-custom-select-text-1');
            const text2 = document.getElementById('rep-custom-select-text-2');
            if (text1) text1.innerText = 'Nessun evento';
            if (text2) text2.innerText = 'Nessun confronto';
            compareState.event1Id = null;
            compareState.event2Id = 'none';
            renderCompareEmptyState("Nessun evento disponibile nel periodo selezionato.");
            return;
        }

        // Validate or set default Event 1
        if (!compareState.event1Id || !list.some(s => String(s.id) === String(compareState.event1Id))) {
            compareState.event1Id = list[0].id;
        }

        // Validate Event 2
        if (compareState.event2Id !== 'none' && !list.some(s => String(s.id) === String(compareState.event2Id))) {
            compareState.event2Id = 'none';
        }

        renderCompareDropdownOptions(1, list, '');
        renderCompareDropdownOptions(2, list, '');
        updateCompareButtonLabels();
        loadAndRenderEventComparison();
    }

    /**
     * Render the items inside a custom comparison dropdown list.
     */
    function renderCompareDropdownOptions(index, list, query) {
        const container = document.getElementById(`rep-dropdown-options-${index}`);
        if (!container) return;

        const cleanQuery = (query || '').trim().toLowerCase();
        let filtered = list;
        if (cleanQuery) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(cleanQuery)));
        }

        let html = '';

        // For Event 2, include "Nessun confronto" option
        if (index === 2) {
            const isNoneActive = compareState.event2Id === 'none';
            if (!cleanQuery || 'nessun confronto'.includes(cleanQuery)) {
                html += `
                    <button type="button" class="reports-dropdown-option ${isNoneActive ? 'active' : ''}" onclick="selectCompareDropdownOption(2, 'none')">
                        <div class="reports-dropdown-option-left">
                            <span class="material-symbols-rounded" style="font-size:18px; color:var(--text-light);">block</span>
                            <span class="option-name">Nessun confronto</span>
                        </div>
                    </button>
                `;
            }
        }

        if (filtered.length === 0 && (!html || index === 1)) {
            container.innerHTML = '<div class="reports-dropdown-empty">Nessun evento trovato</div>';
            return;
        }

        const selectedId = index === 1 ? compareState.event1Id : compareState.event2Id;

        html += filtered.map(s => {
            const isActive = String(s.id) === String(selectedId);
            const rev = Number(s.revenue) || 0;
            return `
                <button type="button" class="reports-dropdown-option ${isActive ? 'active' : ''}" onclick="selectCompareDropdownOption(${index}, ${s.id})">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:${index === 1 ? '#2563eb' : '#8b5cf6'};">festival</span>
                        <span class="option-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                    </div>
                    <span class="reports-dropdown-option-right">${formatCurrency(rev)}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Update trigger button labels based on compareState.
     */
    function updateCompareButtonLabels() {
        const text1 = document.getElementById('rep-custom-select-text-1');
        const text2 = document.getElementById('rep-custom-select-text-2');
        const list = eventsTableState.rawList || [];

        if (text1) {
            const s1 = list.find(s => String(s.id) === String(compareState.event1Id));
            text1.innerText = s1 ? s1.name : 'Seleziona evento...';
        }

        if (text2) {
            if (compareState.event2Id === 'none') {
                text2.innerText = 'Nessun confronto';
            } else {
                const s2 = list.find(s => String(s.id) === String(compareState.event2Id));
                text2.innerText = s2 ? s2.name : 'Nessun confronto';
            }
        }
    }

    /**
     * Toggle custom dropdown open/close state.
     */
    function toggleCompareDropdown(index, e) {
        if (e) e.stopPropagation();

        const panel = document.getElementById(`rep-custom-dropdown-${index}`);
        const btn = document.getElementById(`rep-custom-select-btn-${index}`);
        if (!panel || !btn) return;

        const wasOpen = (panel.style.display === 'flex');
        closeAllCompareDropdowns();

        if (!wasOpen) {
            panel.style.display = 'flex';
            btn.classList.add('open');

            // Reset search input and re-render full list
            const searchInput = document.getElementById(`rep-dropdown-search-${index}`);
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 50);
            }
            renderCompareDropdownOptions(index, eventsTableState.rawList || [], '');
        }
    }

    /**
     * Close all custom comparison dropdowns.
     */
    function closeAllCompareDropdowns() {
        [1, 2].forEach(idx => {
            const panel = document.getElementById(`rep-custom-dropdown-${idx}`);
            const btn = document.getElementById(`rep-custom-select-btn-${idx}`);
            if (panel) panel.style.display = 'none';
            if (btn) btn.classList.remove('open');
        });
        const prodPanel = document.getElementById('rep-prod-event-dropdown');
        const prodBtn = document.getElementById('rep-prod-event-select-btn');
        if (prodPanel) prodPanel.style.display = 'none';
        if (prodBtn) prodBtn.classList.remove('open');

        const catPanel = document.getElementById('rep-prod-cat-dropdown');
        const catBtn = document.getElementById('rep-prod-cat-select-btn');
        if (catPanel) catPanel.style.display = 'none';
        if (catBtn) catBtn.classList.remove('open');

        const inspectPanel = document.getElementById('rep-inspect-event-dropdown');
        const inspectBtn = document.getElementById('rep-inspect-event-select-btn');
        if (inspectPanel) inspectPanel.style.display = 'none';
        if (inspectBtn) inspectBtn.classList.remove('open');
    }

    // Close custom dropdowns on clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.reports-custom-select-box')) {
            closeAllCompareDropdowns();
        }
    });

    /**
     * Filter items inside a custom dropdown by search query.
     */
    function filterCompareDropdownItems(index, query) {
        renderCompareDropdownOptions(index, eventsTableState.rawList || [], query);
    }

    /**
     * Select an option in a custom comparison dropdown.
     */
    function selectCompareDropdownOption(index, id) {
        if (index === 1) {
            compareState.event1Id = id;
        } else {
            compareState.event2Id = id;
        }

        closeAllCompareDropdowns();
        updateCompareButtonLabels();
        loadAndRenderEventComparison();
    }

    /**
     * Load stats for selected events and render dual wave chart.
     */
    async function loadAndRenderEventComparison() {
        const container = document.getElementById('reports-compare-chart-container');
        const summaryBar = document.getElementById('reports-compare-summary-bar');
        if (!container) return;

        const id1 = compareState.event1Id;
        const id2 = compareState.event2Id;

        if (!id1) {
            renderCompareEmptyState("Seleziona almeno un evento per visualizzare il grafico.");
            return;
        }

        compareState.isLoading = true;
        container.innerHTML = '<div class="reports-loading-spinner" style="margin: 40px auto;"></div>';

        try {
            const dateParams = new URLSearchParams();
            if (reportsState.dateFilter.startDate) dateParams.append('start_date', reportsState.dateFilter.startDate);
            if (reportsState.dateFilter.endDate) dateParams.append('end_date', reportsState.dateFilter.endDate);
            const dateQuery = dateParams.toString() ? `&${dateParams.toString()}` : '';

            // Fetch Event 1 stats
            const res1 = await fetch(`/api/stats?sagraId=${id1}${dateQuery}`);
            const data1 = await res1.json();

            let data2 = null;
            if (id2 && id2 !== 'none' && String(id2) !== String(id1)) {
                const res2 = await fetch(`/api/stats?sagraId=${id2}${dateQuery}`);
                data2 = await res2.json();
            }

            const sagra1 = (eventsTableState.rawList || []).find(s => String(s.id) === String(id1)) || { name: `Evento #${id1}` };
            const sagra2 = data2 ? ((eventsTableState.rawList || []).find(s => String(s.id) === String(id2)) || { name: `Evento #${id2}` }) : null;

            // Render summary badges bar
            if (summaryBar) {
                let summaryHtml = `
                    <div class="reports-compare-pill pill-event-1">
                        <span class="pill-dot" style="background:#2563eb;"></span>
                        <span>${escapeHtml(sagra1.name)}:</span>
                        <span class="pill-stat">${formatCurrency(data1.totalRevenue || 0)}</span>
                        <span style="opacity:0.8;font-size:0.75rem;">(${data1.ordersCount || 0} ordini)</span>
                    </div>
                `;
                if (sagra2 && data2) {
                    summaryHtml += `
                        <div class="reports-compare-pill pill-event-2">
                            <span class="pill-dot" style="background:#8b5cf6;"></span>
                            <span>${escapeHtml(sagra2.name)}:</span>
                            <span class="pill-stat">${formatCurrency(data2.totalRevenue || 0)}</span>
                            <span style="opacity:0.8;font-size:0.75rem;">(${data2.ordersCount || 0} ordini)</span>
                        </div>
                    `;
                }
                summaryBar.innerHTML = summaryHtml;
            }

            renderCompareDualWaveChart(data1, sagra1.name, data2, sagra2 ? sagra2.name : null);
            renderCompareTopProducts(data1, sagra1.name, data2, sagra2 ? sagra2.name : null);
            renderCompareCategories(data1, sagra1.name, data2, sagra2 ? sagra2.name : null);
        } catch (err) {
            console.error("Comparison chart load error:", err);
            renderCompareEmptyState("Errore nel caricamento del confronto.");
        } finally {
            compareState.isLoading = false;
        }
    }

    /**
     * Render empty state for compare container.
     */
    function renderCompareEmptyState(message) {
        const container = document.getElementById('reports-compare-chart-container');
        const summaryBar = document.getElementById('reports-compare-summary-bar');
        const prodContainer = document.getElementById('rep-compare-products-list');
        const catContainer = document.getElementById('rep-compare-categories-list');
        if (summaryBar) summaryBar.innerHTML = '';
        if (container) container.innerHTML = `<div class="reports-empty-state">${escapeHtml(message)}</div>`;
        if (prodContainer) prodContainer.innerHTML = `<div class="reports-empty-state">${escapeHtml(message)}</div>`;
        if (catContainer) catContainer.innerHTML = `<div class="reports-empty-state">${escapeHtml(message)}</div>`;
    }

    /**
     * Show custom tooltip for comparison chart.
     */
    function showCompareChartTooltip(e, hourLabel, name1, rev1, name2, rev2) {
        const tooltip = document.getElementById('reports-compare-tooltip');
        if (!tooltip) return;

        let contentHtml = `<div class="reports-tooltip-time">Ore ${escapeHtml(hourLabel)}</div>`;
        contentHtml += `
            <div class="reports-tooltip-val" style="color:#2563eb; font-size: 0.86rem; margin-bottom: 2px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2563eb;margin-right:6px;"></span>
                <span>${escapeHtml(name1)}: ${formatCurrency(rev1)}</span>
            </div>
        `;
        if (name2) {
            contentHtml += `
                <div class="reports-tooltip-val" style="color:#8b5cf6; font-size: 0.86rem;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b5cf6;margin-right:6px;"></span>
                    <span>${escapeHtml(name2)}: ${formatCurrency(rev2)}</span>
                </div>
            `;
        }

        tooltip.innerHTML = contentHtml;

        const dot = e.target;
        const parent = tooltip.offsetParent || tooltip.parentElement;
        if (dot && parent) {
            const dotRect = dot.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            const left = dotRect.left - parentRect.left + (dotRect.width / 2);
            const top = dotRect.top - parentRect.top - 8;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }

        tooltip.classList.add('visible');
    }

    /**
     * Hide custom tooltip for comparison chart.
     */
    function hideCompareChartTooltip() {
        const tooltip = document.getElementById('reports-compare-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    }

    /**
     * Render the Dual Wave Chart for hourly comparison.
     */
    function renderCompareDualWaveChart(data1, name1, data2, name2) {
        const container = document.getElementById('reports-compare-chart-container');
        if (!container) return;

        hideCompareChartTooltip();

        const hourly1 = (data1 && data1.hourlySales) ? data1.hourlySales : [];
        const hourly2 = (data2 && data2.hourlySales) ? data2.hourlySales : [];

        // Build hour map from 00 to 23
        const map1 = new Map();
        hourly1.forEach(h => {
            const slotHour = parseInt(h.hour_slot.split(':')[0], 10);
            map1.set(slotHour, (map1.get(slotHour) || 0) + (Number(h.revenue) || 0));
        });

        const map2 = new Map();
        hourly2.forEach(h => {
            const slotHour = parseInt(h.hour_slot.split(':')[0], 10);
            map2.set(slotHour, (map2.get(slotHour) || 0) + (Number(h.revenue) || 0));
        });

        // Determine active range of hours (e.g. from 09:00 to 23:00 or active min to max)
        const activeHours = [];
        for (let h = 0; h <= 23; h++) {
            if ((map1.get(h) || 0) > 0 || (map2.get(h) || 0) > 0) {
                activeHours.push(h);
            }
        }

        let startHour = 9;
        let endHour = 23;
        if (activeHours.length > 0) {
            startHour = Math.max(0, Math.min(...activeHours) - 1);
            endHour = Math.min(23, Math.max(...activeHours) + 1);
            if (endHour - startHour < 8) {
                endHour = Math.min(23, startHour + 8);
                if (endHour === 23) startHour = Math.max(0, endHour - 8);
            }
        }

        // Build continuous hourly slots
        const slots = [];
        let maxRevenue = 0;

        for (let h = startHour; h <= endHour; h++) {
            const hourLabel = `${String(h).padStart(2, '0')}:00`;
            const rev1 = map1.get(h) || 0;
            const rev2 = map2.get(h) || 0;
            if (rev1 > maxRevenue) maxRevenue = rev1;
            if (rev2 > maxRevenue) maxRevenue = rev2;
            slots.push({ hour: h, label: hourLabel, rev1, rev2 });
        }

        if (slots.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessuna fascia oraria disponibile.</div>';
            return;
        }

        const svgWidth = 900;
        const svgHeight = 170;
        const paddingX = 45;
        const paddingTop = 25;
        const paddingBottom = 30;

        const count = slots.length;
        const usableWidth = svgWidth - (paddingX * 2);
        const usableHeight = svgHeight - paddingTop - paddingBottom;
        const baselineY = svgHeight - paddingBottom;

        // Points for Wave 1
        const points1 = slots.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const ratio = maxRevenue > 0 ? (slot.rev1 / maxRevenue) : 0;
            const y = baselineY - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Points for Wave 2
        const points2 = slots.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const ratio = maxRevenue > 0 ? (slot.rev2 / maxRevenue) : 0;
            const y = baselineY - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Spline paths
        const linePath1 = buildMonotoneSplinePath(points1, baselineY);
        const firstX = points1[0].x;
        const lastX = points1[points1.length - 1].x;
        const bottomY = baselineY + 8;
        const areaPath1 = `${linePath1} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

        let wave2Markup = '';
        let dots2Html = '';
        if (data2 && name2) {
            const linePath2 = buildMonotoneSplinePath(points2, baselineY);
            const areaPath2 = `${linePath2} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

            dots2Html = points2.map(pt => {
                if (pt.slot.rev2 <= 0) return '';
                const leftPct = (pt.x / svgWidth * 100).toFixed(2);
                const topPct = (pt.y / svgHeight * 100).toFixed(2);
                return `
                    <div class="reports-chart-point-dot" 
                         style="left: ${leftPct}%; top: ${topPct}%; background: #8b5cf6;"
                         onmouseenter="showCompareChartTooltip(event, '${escapeHtml(pt.slot.label)}', '${escapeHtml(name1)}', ${pt.slot.rev1}, '${escapeHtml(name2)}', ${pt.slot.rev2})"
                         onmouseleave="hideCompareChartTooltip()">
                    </div>
                `;
            }).join('');

            wave2Markup = `
                <path class="reports-wave-area-path" d="${areaPath2}" style="fill:url(#compareGradient2);" />
                <path class="reports-wave-line-path" d="${linePath2}" style="stroke:#8b5cf6;" />
            `;
        }

        const dots1Html = points1.map((pt, i) => {
            if (pt.slot.rev1 <= 0 && (!data2 || points2[i].slot.rev2 <= 0)) return '';
            const leftPct = (pt.x / svgWidth * 100).toFixed(2);
            const topPct = (pt.y / svgHeight * 100).toFixed(2);
            return `
                <div class="reports-chart-point-dot" 
                     style="left: ${leftPct}%; top: ${topPct}%; background: #2563eb;"
                     onmouseenter="showCompareChartTooltip(event, '${escapeHtml(pt.slot.label)}', '${escapeHtml(name1)}', ${pt.slot.rev1}, ${name2 ? `'${escapeHtml(name2)}'` : 'null'}, ${points2[i].slot.rev2})"
                     onmouseleave="hideCompareChartTooltip()">
                </div>
            `;
        }).join('');

        const labelsHtml = slots.map((slot, idx) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (idx * (usableWidth / (count - 1)));
            return `
                <span class="reports-wave-label" style="position: absolute; left: ${(x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
                    ${escapeHtml(slot.label)}
                </span>
            `;
        }).join('');

        container.innerHTML = `
            <svg class="reports-wave-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="compareGradient1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                    </linearGradient>
                    <linearGradient id="compareGradient2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0" />
                    </linearGradient>
                </defs>
                ${wave2Markup}
                <path class="reports-wave-area-path" d="${areaPath1}" style="fill:url(#compareGradient1);" />
                <path class="reports-wave-line-path" d="${linePath1}" style="stroke:#2563eb;" />
            </svg>
            <div class="reports-wave-dots-wrap">
                ${dots2Html}
                ${dots1Html}
            </div>
            <div class="reports-wave-labels-wrap">
                ${labelsHtml}
            </div>
        `;
    }

    /**
     * Helper to render a Top 3 Podium column for an event.
     */
    function renderPodiumColumn(topItems, eventName, colorHex, gradientCss, totalEventRevenue) {
        if (!topItems || topItems.length === 0) {
            return `
                <div class="reports-compare-podium-col">
                    <div class="reports-podium-col-header" style="color: ${colorHex};">
                        <span class="reports-podium-event-name" title="${escapeHtml(eventName)}">${escapeHtml(eventName)}</span>
                    </div>
                    <div class="reports-empty-state" style="padding: 24px 8px; font-size: 0.8rem;">Nessun piatto venduto</div>
                </div>
            `;
        }

        const totalRev = Number(totalEventRevenue) || 0;

        const itemsHtml = topItems.map((p, idx) => {
            const rank = idx + 1;
            const rev = Number(p.revenue) || 0;
            const qty = Number(p.qty) || 0;
            const pct = totalRev > 0 ? Math.min(100, Math.round((rev / totalRev) * 100)) : 0;
            const shareText = totalRev > 0 ? `${((rev / totalRev) * 100).toFixed(1)}%` : '0%';

            return `
                <div class="reports-podium-item">
                    <div class="reports-podium-rank">#${rank}</div>
                    <div class="reports-podium-info">
                        <div class="reports-podium-title-row">
                            <span class="reports-podium-item-name" title="${escapeHtml(p.product_name)}">${escapeHtml(p.product_name)}</span>
                            <span class="reports-podium-item-rev">${formatCurrency(rev)}</span>
                        </div>
                        <div class="reports-podium-sub-row">
                            <div class="reports-progress-track" style="height: 5px; flex: 1;">
                                <div class="reports-progress-fill" style="width: ${Math.max(pct, rev > 0 ? 1 : 0)}%; background: ${gradientCss};"></div>
                            </div>
                            <span class="reports-podium-item-qty">${qty.toLocaleString('it-IT')} pz • ${shareText}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="reports-compare-podium-col">
                <div class="reports-podium-col-header" style="color: ${colorHex};">
                    <span class="reports-podium-event-name" title="${escapeHtml(eventName)}">${escapeHtml(eventName)}</span>
                </div>
                <div class="reports-podium-list">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Render Top 3 Products per Event inside the comparison card.
     */
    function renderCompareTopProducts(data1, name1, data2, name2) {
        const container = document.getElementById('rep-compare-products-list');
        if (!container) return;

        const items1 = (data1 && data1.topItems) ? [...data1.topItems].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0)).slice(0, 3) : [];
        const isDual = (data2 && name2);

        if (!isDual) {
            // Single event mode: render top 3 of Event 1
            const col1 = renderPodiumColumn(items1, name1, '#2563eb', 'linear-gradient(90deg, #2563eb, #3b82f6)', data1?.totalRevenue);
            container.innerHTML = `
                <div class="reports-compare-podium-grid">
                    ${col1}
                </div>
            `;
            return;
        }

        // Dual comparison mode: render podium for Event 1 and podium for Event 2 stacked vertically
        const items2 = (data2 && data2.topItems) ? [...data2.topItems].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0)).slice(0, 3) : [];
        const col1 = renderPodiumColumn(items1, name1, '#2563eb', 'linear-gradient(90deg, #2563eb, #3b82f6)', data1?.totalRevenue);
        const col2 = renderPodiumColumn(items2, name2, '#8b5cf6', 'linear-gradient(90deg, #8b5cf6, #a855f7)', data2?.totalRevenue);

        container.innerHTML = `
            <div class="reports-compare-podium-grid">
                ${col1}
                ${col2}
            </div>
        `;
    }

    /**
     * Render Categories Comparison progress bars (Dual or Single).
     */
    function renderCompareCategories(data1, name1, data2, name2) {
        const container = document.getElementById('rep-compare-categories-list');
        if (!container) return;

        const cats1 = (data1 && data1.categories) ? data1.categories : [];
        const cats2 = (data2 && data2.categories) ? data2.categories : [];

        const tot1 = Number(data1?.totalRevenue) || 0;
        const tot2 = Number(data2?.totalRevenue) || 0;

        // Build category maps
        const map1 = new Map();
        cats1.forEach(c => {
            map1.set(c.category_name, { qty: Number(c.total_qty) || 0, revenue: Number(c.total_revenue) || 0 });
        });

        const map2 = new Map();
        cats2.forEach(c => {
            map2.set(c.category_name, { qty: Number(c.total_qty) || 0, revenue: Number(c.total_revenue) || 0 });
        });

        // Combined unique category names
        const allNames = Array.from(new Set([...map1.keys(), ...map2.keys()]));

        if (allNames.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessun dato per categorie nel periodo selezionato</div>';
            return;
        }

        // Sort by total combined revenue descending
        allNames.sort((a, b) => {
            const revA = (map1.get(a)?.revenue || 0) + (map2.get(a)?.revenue || 0);
            const revB = (map1.get(b)?.revenue || 0) + (map2.get(b)?.revenue || 0);
            return revB - revA;
        });

        const isDual = (data2 && name2);

        const html = allNames.map(catName => {
            const c1 = map1.get(catName) || { qty: 0, revenue: 0 };
            const c2 = map2.get(catName) || { qty: 0, revenue: 0 };

            const pct1 = tot1 > 0 ? Math.min(100, Math.round((c1.revenue / tot1) * 100)) : 0;
            const pct2 = tot2 > 0 ? Math.min(100, Math.round((c2.revenue / tot2) * 100)) : 0;
            const share1 = tot1 > 0 ? `${((c1.revenue / tot1) * 100).toFixed(1)}%` : '0%';
            const share2 = tot2 > 0 ? `${((c2.revenue / tot2) * 100).toFixed(1)}%` : '0%';

            if (!isDual) {
                // Single event mode: styled with Event 1 blue theme
                return `
                    <div class="reports-progress-item">
                        <div class="reports-progress-header">
                            <span class="reports-progress-title" title="${escapeHtml(catName)}">${escapeHtml(catName)}</span>
                            <div class="reports-progress-values">
                                <span class="reports-progress-amount">${formatCurrency(c1.revenue)}</span>
                                <span class="reports-progress-sub">(${c1.qty.toLocaleString('it-IT')} pezzi • ${share1})</span>
                            </div>
                        </div>
                        <div class="reports-progress-track">
                            <div class="reports-progress-fill" style="width: ${Math.max(pct1, c1.revenue > 0 ? 1 : 0)}%; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                        </div>
                    </div>
                `;
            }

            // Dual comparison mode
            return `
                <div class="reports-compare-item">
                    <div class="reports-compare-item-title" title="${escapeHtml(catName)}">${escapeHtml(catName)}</div>
                    
                    <!-- Bar 1: Event 1 -->
                    <div class="reports-compare-bar-row">
                        <div class="reports-compare-bar-header">
                            <span class="reports-compare-bar-name" style="color: #2563eb;">
                                <span>${escapeHtml(name1)}</span>
                            </span>
                            <div class="reports-compare-bar-vals">
                                <span class="reports-compare-bar-amt">${formatCurrency(c1.revenue)}</span>
                                <span class="reports-compare-bar-sub">(${c1.qty.toLocaleString('it-IT')} pz • ${share1})</span>
                            </div>
                        </div>
                        <div class="reports-progress-track">
                            <div class="reports-progress-fill" style="width: ${Math.max(pct1, c1.revenue > 0 ? 1 : 0)}%; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                        </div>
                    </div>

                    <!-- Bar 2: Event 2 -->
                    <div class="reports-compare-bar-row">
                        <div class="reports-compare-bar-header">
                            <span class="reports-compare-bar-name" style="color: #8b5cf6;">
                                <span>${escapeHtml(name2)}</span>
                            </span>
                            <div class="reports-compare-bar-vals">
                                <span class="reports-compare-bar-amt">${formatCurrency(c2.revenue)}</span>
                                <span class="reports-compare-bar-sub">(${c2.qty.toLocaleString('it-IT')} pz • ${share2})</span>
                            </div>
                        </div>
                        <div class="reports-progress-track">
                            <div class="reports-progress-fill" style="width: ${Math.max(pct2, c2.revenue > 0 ? 1 : 0)}%; background: linear-gradient(90deg, #8b5cf6, #a855f7);"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Open the existing POS statistics modal for the selected event.
     */
    function openEventStatsModal(sagraId) {
        if (typeof window.showStats === 'function') {
            window.showStats(sagraId, reportsState.dateFilter);
        } else {
            console.warn("window.showStats is not available");
        }
    }

    /**
     * Render error view.
     */
    function renderOverviewError(message) {
        const container = document.getElementById('rep-chart-sagras-bars');
        if (container) {
            container.innerHTML = `<div class="reports-empty-state" style="color:var(--danger, #ef4444);">Errore caricamento: ${escapeHtml(message)}</div>`;
        }
    }

    /* =========================================================================
       PRODUCTS BREAKDOWN TAB (TAB 3: DETTAGLI PRODOTTI)
       ========================================================================= */

    const productsTableState = {
        rawList: [],
        filteredList: [],
        exhaustedList: [],
        surplusList: [],
        renderedCount: 0,
        isLoadingMore: false,
        sortKey: 'revenue',
        sortDirection: 'desc',
        selectedEventId: 'all',
        selectedCategory: 'all',
        grandTotalRevenue: 0,
        grandTotalQty: 0
    };

    /**
     * Fetch products breakdown from /api/reports/products
     */
    async function loadProductsBreakdown() {
        const tbody = document.getElementById('rep-products-tbody');
        const refreshIcon = document.getElementById('rep-prod-refresh-icon');
        const refreshBtn = document.getElementById('rep-prod-refresh-btn');

        if (refreshIcon) refreshIcon.classList.add('spin');
        if (refreshBtn) refreshBtn.disabled = true;

        if (tbody && (!productsTableState.rawList || productsTableState.rawList.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="6" class="reports-table-loading"><span class="material-symbols-rounded spin">progress_activity</span> Caricamento prodotti in corso...</td></tr>';
        }

        try {
            // Also refresh sagras list in background to ensure new events are available
            fetch('/api/reports/overview').then(r => r.json()).then(ov => {
                if (ov.success && ov.sagras) {
                    eventsTableState.rawList = ov.sagras;
                    renderProdEventDropdownOptions(ov.sagras, '');
                    updateProdEventButtonLabel();
                }
            }).catch(() => {});

            const params = new URLSearchParams();
            if (reportsState.dateFilter.startDate) params.append('start_date', reportsState.dateFilter.startDate);
            if (reportsState.dateFilter.endDate) params.append('end_date', reportsState.dateFilter.endDate);
            if (productsTableState.selectedEventId && productsTableState.selectedEventId !== 'all') {
                params.append('sagra_id', productsTableState.selectedEventId);
            }

            const queryString = params.toString();
            const url = `/api/reports/products${queryString ? '?' + queryString : ''}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Errore durante il caricamento dei prodotti");
            }

            productsTableState.rawList = data.products || [];
            productsTableState.exhaustedList = data.exhaustedProducts || [];
            productsTableState.surplusList = data.surplusProducts || [];
            productsTableState.grandTotalRevenue = Number(data.grandTotalRevenue) || 0;
            productsTableState.grandTotalQty = Number(data.grandTotalQty) || 0;

            const sagrasList = (eventsTableState.rawList && eventsTableState.rawList.length > 0)
                ? eventsTableState.rawList
                : (reportsState.overviewData?.sagras || []);

            filterReportsProductsList();
            renderProdEventDropdownOptions(sagrasList, '');
            updateProdEventButtonLabel();
            renderProdCatDropdownOptions('');
            updateProdCatButtonLabel();
            renderTopAndFlopProducts();
            renderExhaustedProducts();
            renderSurplusProducts();
        } catch (e) {
            console.error("Error loading products breakdown:", e);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="reports-table-empty" style="color:var(--danger,#ef4444);">Errore nel caricamento: ${escapeHtml(e.message)}</td></tr>`;
            }
        } finally {
            if (refreshIcon) refreshIcon.classList.remove('spin');
            if (refreshBtn) refreshBtn.disabled = false;
        }
    }

    /**
     * Helper to sort products array based on sortKey and sortDirection.
     */
    function sortProductsList(list, key, direction) {
        const sorted = [...list];
        sorted.sort((a, b) => {
            let valA, valB;
            if (key === 'name') {
                valA = (a.product_name || '').toLowerCase();
                valB = (b.product_name || '').toLowerCase();
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (key === 'category') {
                valA = (a.category_name || '').toLowerCase();
                valB = (b.category_name || '').toLowerCase();
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (key === 'qty') {
                valA = Number(a.total_qty) || 0;
                valB = Number(b.total_qty) || 0;
            } else if (key === 'price') {
                valA = Number(a.avg_price) || 0;
                valB = Number(b.avg_price) || 0;
            } else if (key === 'share') {
                valA = Number(a.total_revenue) || 0;
                valB = Number(b.total_revenue) || 0;
            } else { // 'revenue'
                valA = Number(a.total_revenue) || 0;
                valB = Number(b.total_revenue) || 0;
            }

            return direction === 'asc' ? valA - valB : valB - valA;
        });
        return sorted;
    }

    /**
     * Shared template to render a single row for Top 5 or Flop 5 cards (by quantity sold).
     */
    function renderTopFlopItemTemplate(p, rank, maxQty, isTop) {
        const rev = Number(p.total_revenue) || 0;
        const qty = Number(p.total_qty) || 0;
        const cat = (p.category_name || 'Altro').trim();
        const rankClass = 'rank-other';
        const pct = maxQty > 0 ? Math.min(100, Math.max(0, (qty / maxQty) * 100)) : 0;
        const barGradient = 'linear-gradient(90deg, #64748b, #94a3b8)';

        return `
            <div class="reports-topflop-item" onclick="openReportsProductModal('${escapeHtml(p.product_name)}')" title="Clicca per visualizzare le statistiche dettagliate">
                <div class="reports-topflop-rank ${rankClass}">${rank}</div>
                <div class="reports-topflop-info">
                    <div class="reports-topflop-name-row">
                        <span class="reports-topflop-name">${escapeHtml(p.product_name)}</span>
                        <span class="reports-topflop-rev" style="color: var(--text-main); font-weight: 800;">${qty.toLocaleString('it-IT')} pz</span>
                    </div>
                    <div class="reports-topflop-sub-row">
                        <span>${escapeHtml(cat)} • ${formatCurrency(rev)}</span>
                        <div class="reports-topflop-track" style="max-width: 90px;">
                            <div class="reports-topflop-bar" style="width: ${Math.max(pct, qty > 0 ? 4 : 0)}%; background: ${barGradient};"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Top 5 Best Sellers and Flop 5 least sold items by quantity sold.
     */
    function renderTopAndFlopProducts() {
        const top5Container = document.getElementById('rep-products-top5-list');
        const flop5Container = document.getElementById('rep-products-flop5-list');
        if (!top5Container || !flop5Container) return;

        let list = productsTableState.rawList || [];
        if (productsTableState.selectedCategory && productsTableState.selectedCategory !== 'all') {
            list = list.filter(p => (p.category_name || 'Altro').trim() === productsTableState.selectedCategory);
        }

        if (list.length === 0) {
            top5Container.innerHTML = '<div style="text-align:center; padding: 18px; color: var(--text-light); font-size: 0.84rem;">Nessun prodotto disponibile</div>';
            flop5Container.innerHTML = '<div style="text-align:center; padding: 18px; color: var(--text-light); font-size: 0.84rem;">Nessun prodotto disponibile</div>';
            return;
        }

        // Top 5 by quantity sold
        const top5 = [...list].sort((a, b) => {
            const diffQty = (Number(b.total_qty) || 0) - (Number(a.total_qty) || 0);
            if (diffQty !== 0) return diffQty;
            return (Number(b.total_revenue) || 0) - (Number(a.total_revenue) || 0);
        }).slice(0, 5);
        const maxTopQty = Number(top5[0]?.total_qty) || 1;
        top5Container.innerHTML = top5.map((p, idx) => renderTopFlopItemTemplate(p, idx + 1, maxTopQty, true)).join('');

        // Flop 5 (Least quantity sold)
        const flop5 = [...list].sort((a, b) => {
            const diffQty = (Number(a.total_qty) || 0) - (Number(b.total_qty) || 0);
            if (diffQty !== 0) return diffQty;
            return (Number(a.total_revenue) || 0) - (Number(b.total_revenue) || 0);
        }).slice(0, 5);
        const maxFlopQty = Math.max(...flop5.map(p => Number(p.total_qty) || 0), 1);
        flop5Container.innerHTML = flop5.map((p, idx) => renderTopFlopItemTemplate(p, idx + 1, maxFlopQty, false)).join('');
    }

    /**
     * Render the list of products with exhausted stock.
     */
    /**
     * Render the list of products with exhausted stock.
     */
    function renderExhaustedProducts() {
        const container = document.getElementById('rep-products-exhausted-list');
        if (!container) return;

        let list = productsTableState.exhaustedList || [];
        if (productsTableState.selectedCategory && productsTableState.selectedCategory !== 'all') {
            list = list.filter(p => (p.category_name || 'Altro').trim() === productsTableState.selectedCategory);
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 18px 12px; color: var(--text-light);">
                    <span class="material-symbols-rounded" style="font-size: 28px; color: var(--success, #10b981); display: block; margin-bottom: 4px;">check_circle</span>
                    <strong style="color: var(--text-main); font-size: 0.88rem;">Nessun prodotto esaurito</strong>
                    <div style="font-size: 0.78rem; margin-top: 2px;">Tutti i prodotti con limite di scorte sono ancora disponibili.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map((p, idx) => {
            const rank = idx + 1;
            const soldQty = Number(p.total_sold_qty) || 0;
            const cat = (p.category_name || 'Altro').trim();
            const sagraName = p.sagra_name || 'Evento';

            let exhaustedTimeStr = 'Orario non disp.';
            if (p.exhausted_at) {
                try {
                    const d = new Date(p.exhausted_at);
                    if (!isNaN(d.getTime())) {
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mm = String(d.getMinutes()).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        exhaustedTimeStr = `Esaurito ore ${hh}:${mm} (${day}/${month})`;
                    }
                } catch (e) {}
            }

            const ochreDot = `<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #d97706; margin-left: 6px; vertical-align: middle;" title="Prodotto Esaurito"></span>`;

            return `
                <div class="reports-topflop-item" onclick="openReportsProductModal('${escapeHtml(p.product_name)}', ${p.sagra_id}, '${escapeHtml(p.sagra_name)}')" title="Clicca per visualizzare le statistiche del piatto per ${escapeHtml(sagraName)}">
                    <div class="reports-topflop-rank rank-other">${rank}</div>
                    <div class="reports-topflop-info">
                        <div class="reports-topflop-name-row">
                            <span class="reports-topflop-name">${escapeHtml(p.product_name)}${ochreDot}</span>
                            <span class="reports-topflop-rev" style="color: var(--text-main); font-weight: 700;">0 pz rimasti</span>
                        </div>
                        <div class="reports-topflop-sub-row">
                            <span>${escapeHtml(cat)} • ${escapeHtml(sagraName)}</span>
                            <span style="font-weight: 600; color: var(--text-light); font-size: 0.76rem;">${soldQty.toLocaleString('it-IT')} venduti (${exhaustedTimeStr})</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render the list of products with high remaining stock relative to sales.
     */
    function renderSurplusProducts() {
        const container = document.getElementById('rep-products-surplus-list');
        if (!container) return;

        let list = productsTableState.surplusList || [];
        if (productsTableState.selectedCategory && productsTableState.selectedCategory !== 'all') {
            list = list.filter(p => (p.category_name || 'Altro').trim() === productsTableState.selectedCategory);
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 18px 12px; color: var(--text-light);">
                    <span class="material-symbols-rounded" style="font-size: 28px; color: var(--text-light); display: block; margin-bottom: 4px;">inventory_2</span>
                    <strong style="color: var(--text-main); font-size: 0.88rem;">Nessun prodotto con scorte tracciate</strong>
                    <div style="font-size: 0.78rem; margin-top: 2px;">Nessun articolo con quantità configurata nel periodo selezionato.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map((p, idx) => {
            const rank = idx + 1;
            const remaining = Number(p.remaining_stock) || 0;
            const soldQty = Number(p.total_sold_qty) || 0;
            const unsoldPct = Number(p.unsold_pct) || 0;
            const cat = (p.category_name || 'Altro').trim();
            const sagraName = p.sagra_name || 'Evento';

            return `
                <div class="reports-topflop-item" onclick="openReportsProductModal('${escapeHtml(p.product_name)}', ${p.sagra_id}, '${escapeHtml(p.sagra_name)}')" title="Clicca per visualizzare le statistiche del piatto per ${escapeHtml(sagraName)}">
                    <div class="reports-topflop-rank rank-other">${rank}</div>
                    <div class="reports-topflop-info">
                        <div class="reports-topflop-name-row">
                            <span class="reports-topflop-name">${escapeHtml(p.product_name)}</span>
                            <span class="reports-topflop-rev" style="color: var(--text-main); font-weight: 700;">${remaining.toLocaleString('it-IT')} pz rimasti</span>
                        </div>
                        <div class="reports-topflop-sub-row">
                            <span>${escapeHtml(cat)} • ${escapeHtml(sagraName)}</span>
                            <span style="font-weight: 600; color: var(--text-light); font-size: 0.76rem;">${soldQty.toLocaleString('it-IT')} venduti (${unsoldPct}% invenduto)</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Filter products by category and search input query and re-render.
     */
    function filterReportsProductsList() {
        const searchInput = document.getElementById('rep-products-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const list = productsTableState.rawList || [];

        let filtered = list;
        if (productsTableState.selectedCategory && productsTableState.selectedCategory !== 'all') {
            filtered = filtered.filter(p => (p.category_name || 'Altro').trim() === productsTableState.selectedCategory);
        }
        if (query) {
            filtered = filtered.filter(p => 
                (p.product_name && p.product_name.toLowerCase().includes(query)) ||
                (p.category_name && p.category_name.toLowerCase().includes(query))
            );
        }

        productsTableState.filteredList = sortProductsList(filtered, productsTableState.sortKey, productsTableState.sortDirection);

        const countBadge = document.getElementById('rep-products-count-badge');
        if (countBadge) {
            countBadge.innerText = `${productsTableState.filteredList.length} ${productsTableState.filteredList.length === 1 ? 'prodotto' : 'prodotti'}`;
        }

        renderTopAndFlopProducts();
        renderExhaustedProducts();
        renderSurplusProducts();
        renderNextProductsChunk(true);

        const wrapper = document.getElementById('rep-products-table-wrapper');
        if (wrapper) wrapper.scrollTop = 0;
    }

    /**
     * Render next chunk of products (10 per page) with lazy scroll append.
     */
    function renderNextProductsChunk(reset = false) {
        const tbody = document.getElementById('rep-products-tbody');
        if (!tbody) return;

        if (reset) {
            productsTableState.renderedCount = 0;
            updateProductsSortArrows();
        }

        const filtered = productsTableState.filteredList || [];
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="reports-table-empty">Nessun prodotto trovato per i filtri selezionati</td></tr>';
            return;
        }

        const start = productsTableState.renderedCount;
        const chunkSize = 10;
        const nextChunk = filtered.slice(start, start + chunkSize);

        if (nextChunk.length === 0 && !reset) return;

        const grandTotal = productsTableState.grandTotalRevenue || 1;

        const rowsHtml = nextChunk.map(p => {
            const rev = Number(p.total_revenue) || 0;
            const qty = Number(p.total_qty) || 0;
            const avgPrice = Number(p.avg_price) || (qty > 0 ? rev / qty : 0);
            const share = grandTotal > 0 ? (rev / grandTotal) * 100 : 0;
            const sharePctFormatted = `${share.toFixed(1)}%`;

            const cat = (p.category_name || 'Altro').trim();
            const catIcon = getCategoryIconName(cat);

            return `
                <tr onclick="openReportsProductModal('${escapeHtml(p.product_name)}')" style="cursor: pointer;" title="Clicca per visualizzare le statistiche dettagliate del piatto">
                    <td>
                        <div class="reports-event-name-cell">
                            <span class="material-symbols-rounded" style="font-size: 18px; color: var(--primary, #2563eb); margin-right: 4px;">${catIcon}</span>
                            <span class="reports-event-name">${escapeHtml(p.product_name)}</span>
                        </div>
                    </td>
                    <td>
                        <span class="reports-table-cat-badge">${escapeHtml(cat)}</span>
                    </td>
                    <td class="th-align-right font-medium">
                        ${qty.toLocaleString('it-IT')} pz
                    </td>
                    <td class="th-align-right" style="color: var(--text-light);">
                        ${formatCurrency(avgPrice)}
                    </td>
                    <td class="th-align-right font-bold" style="color: var(--text-main);">
                        ${formatCurrency(rev)}
                    </td>
                    <td class="th-align-right font-medium">
                        <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px;">
                            <div class="reports-progress-track" style="width: 50px; height: 5px; margin: 0;">
                                <div class="reports-progress-fill" style="width: ${Math.max(share, rev > 0 ? 1 : 0)}%; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                            </div>
                            <span style="min-width: 42px; font-size: 0.82rem;">${sharePctFormatted}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Remove previous status row if existing
        const prevStatusRow = tbody.querySelector('.reports-table-status-row');
        if (prevStatusRow) prevStatusRow.remove();

        if (reset) {
            tbody.innerHTML = rowsHtml;
        } else {
            tbody.insertAdjacentHTML('beforeend', rowsHtml);
        }

        productsTableState.renderedCount += nextChunk.length;

        // Append 11th row for loading / end of list
        let statusRowHtml = '';
        if (productsTableState.renderedCount < filtered.length) {
            statusRowHtml = `
                <tr class="reports-table-status-row reports-table-more-row">
                    <td colspan="6">
                        <div class="reports-table-indicator-content">
                            <span class="material-symbols-rounded spin" style="font-size: 16px; color: var(--primary);">progress_activity</span>
                            <span>Scorri per caricare altri prodotti (${productsTableState.renderedCount} di ${filtered.length} visualizzati)</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            statusRowHtml = `
                <tr class="reports-table-status-row reports-table-end-row">
                    <td colspan="6">
                        <div class="reports-table-indicator-content">
                            <span class="material-symbols-rounded" style="font-size: 16px; color: var(--primary);">check_circle</span>
                            <span>Fine elenco (${filtered.length} ${filtered.length === 1 ? 'prodotto' : 'prodotti totali'})</span>
                        </div>
                    </td>
                </tr>
            `;
        }
        tbody.insertAdjacentHTML('beforeend', statusRowHtml);
    }

    /**
     * Infinite lazy scroll for Products Table.
     */
    function handleProductsTableScroll(container) {
        if (!container) return;
        if (productsTableState.renderedCount >= productsTableState.filteredList.length) return;
        if (productsTableState.isLoadingMore) return;

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 30) {
            productsTableState.isLoadingMore = true;
            renderNextProductsChunk(false);
            productsTableState.isLoadingMore = false;
        }
    }

    /**
     * Update sorting indicators on Products Table column headers.
     */
    function updateProductsSortArrows() {
        const icons = document.querySelectorAll('[data-sort-icon-prod]');
        icons.forEach(icon => {
            const field = icon.getAttribute('data-sort-icon-prod');
            if (field === productsTableState.sortKey) {
                icon.innerText = productsTableState.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
                icon.classList.add('active');
            } else {
                icon.innerText = '';
                icon.classList.remove('active');
            }
        });
    }

    /**
     * Sort products table by a specific column.
     */
    function sortReportsProductsBy(field) {
        if (productsTableState.sortKey === field) {
            productsTableState.sortDirection = productsTableState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            productsTableState.sortKey = field;
            productsTableState.sortDirection = (field === 'name' || field === 'category') ? 'asc' : 'desc';
        }
        filterReportsProductsList();
    }

    /**
     * Render options list for the Product Tab Event Filter custom dropdown.
     */
    function renderProdEventDropdownOptions(list, query) {
        const container = document.getElementById('rep-prod-event-options');
        if (!container) return;

        const cleanQuery = (query || '').trim().toLowerCase();
        let filtered = list;
        if (cleanQuery) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(cleanQuery)));
        }

        let html = '';
        const isAllActive = productsTableState.selectedEventId === 'all';
        if (!cleanQuery || 'tutti gli eventi'.includes(cleanQuery)) {
            html += `
                <button type="button" class="reports-dropdown-option ${isAllActive ? 'active' : ''}" onclick="selectProdEventDropdownOption('all')">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--primary);">apps</span>
                        <span class="option-name font-bold">Tutti gli eventi</span>
                    </div>
                </button>
            `;
        }

        if (filtered.length === 0 && !html) {
            container.innerHTML = '<div class="reports-dropdown-empty">Nessun evento trovato</div>';
            return;
        }

        html += filtered.map(s => {
            const isActive = String(s.id) === String(productsTableState.selectedEventId);
            const rev = Number(s.revenue) || 0;
            return `
                <button type="button" class="reports-dropdown-option ${isActive ? 'active' : ''}" onclick="selectProdEventDropdownOption(${s.id})">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--primary);">festival</span>
                        <span class="option-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                    </div>
                    <span class="reports-dropdown-option-right">${formatCurrency(rev)}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Update label of Product Tab Event trigger button.
     */
    function updateProdEventButtonLabel() {
        const textEl = document.getElementById('rep-prod-event-select-text');
        const dateBadge = document.getElementById('rep-prod-event-date-text');
        if (!textEl) return;

        if (productsTableState.selectedEventId === 'all') {
            textEl.innerText = 'Tutti gli eventi';
            if (dateBadge) dateBadge.innerText = 'Tutto lo storico';
        } else {
            const list = eventsTableState.rawList || [];
            const s = list.find(item => String(item.id) === String(productsTableState.selectedEventId));
            textEl.innerText = s ? s.name : 'Tutti gli eventi';
            if (dateBadge && s) {
                try {
                    const d = new Date(s.created_at || Date.now());
                    dateBadge.innerText = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                } catch(e) {
                    dateBadge.innerText = 'Data N/D';
                }
            }
        }
    }

    /**
     * Toggle open/close of Product Tab Event Filter custom dropdown.
     */
    function toggleProdEventDropdown(e) {
        if (e) e.stopPropagation();

        const panel = document.getElementById('rep-prod-event-dropdown');
        const btn = document.getElementById('rep-prod-event-select-btn');
        if (!panel || !btn) return;

        const wasOpen = (panel.style.display === 'flex');
        closeAllCompareDropdowns();

        if (!wasOpen) {
            panel.style.display = 'flex';
            btn.classList.add('open');

            const searchInput = document.getElementById('rep-prod-event-search');
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 50);
            }
            renderProdEventDropdownOptions(eventsTableState.rawList || [], '');
        }
    }

    /**
     * Filter items in Product Tab Event Filter dropdown by search text.
     */
    function filterProdEventDropdownItems(query) {
        renderProdEventDropdownOptions(eventsTableState.rawList || [], query);
    }

    /**
     * Select an event in Product Tab Event Filter.
     */
    function selectProdEventDropdownOption(id) {
        productsTableState.selectedEventId = id;
        updateProdEventButtonLabel();
        closeAllCompareDropdowns();
        loadProductsBreakdown();
    }

    /**
     * Render options list for the Product Tab Category Filter custom dropdown.
     */
    function renderProdCatDropdownOptions(query) {
        const container = document.getElementById('rep-prod-cat-options');
        if (!container) return;

        const cleanQuery = (query || '').trim().toLowerCase();
        const raw = productsTableState.rawList || [];
        const catMap = new Map();

        raw.forEach(p => {
            const cName = (p.category_name || 'Altro').trim();
            catMap.set(cName, (catMap.get(cName) || 0) + 1);
        });

        let catList = Array.from(catMap.entries()).map(([name, count]) => ({ name, count }));
        if (cleanQuery) {
            catList = catList.filter(c => c.name.toLowerCase().includes(cleanQuery));
        }

        let html = '';
        const isAllActive = productsTableState.selectedCategory === 'all';
        if (!cleanQuery || 'tutte le categorie'.includes(cleanQuery)) {
            html += `
                <button type="button" class="reports-dropdown-option ${isAllActive ? 'active' : ''}" onclick="selectProdCatDropdownOption('all')">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--primary);">category</span>
                        <span class="option-name font-bold">Tutte le categorie</span>
                    </div>
                </button>
            `;
        }

        if (catList.length === 0 && !html) {
            container.innerHTML = '<div class="reports-dropdown-empty">Nessuna categoria trovata</div>';
            return;
        }

        html += catList.map(c => {
            const isActive = productsTableState.selectedCategory === c.name;
            const icon = getCategoryIconName(c.name);
            return `
                <button type="button" class="reports-dropdown-option ${isActive ? 'active' : ''}" onclick="selectProdCatDropdownOption('${escapeHtml(c.name)}')">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--primary);">${icon}</span>
                        <span class="option-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
                    </div>
                    <span class="reports-dropdown-option-right" style="font-size:0.75rem;">${c.count} piatti</span>
                </button>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Helper to get appropriate Material Symbol icon name for a category.
     */
    function getCategoryIconName(catName) {
        if (!catName || catName === 'all') return 'category';
        const name = catName.trim().toLowerCase();
        if (name === 'cibo' || name.includes('cucin') || name.includes('prim') || name.includes('second') || name.includes('panin') || name.includes('piad') || name.includes('pizz') || name.includes('piatt') || name.includes('gastronom')) {
            return 'restaurant';
        }
        if (name === 'bevande' || name.includes('drink') || name.includes('bar') || name.includes('birr') || name.includes('vin') || name.includes('bibit') || name.includes('acqua') || name.includes('caff') || name.includes('cocktail')) {
            return 'local_bar';
        }
        if (name === 'dolci' || name.includes('dessert') || name.includes('torta') || name.includes('gelat') || name.includes('pasticc')) {
            return 'cake';
        }
        if (name === 'prodotti base' || name.includes('base') || name.includes('ingredient') || name.includes('materie')) {
            return 'inventory_2';
        }
        return 'label';
    }

    /**
     * Update label of Product Tab Category trigger button.
     */
    function updateProdCatButtonLabel() {
        const textEl = document.getElementById('rep-prod-cat-select-text');
        const iconEl = document.getElementById('rep-prod-cat-btn-icon');
        if (!textEl) return;

        if (productsTableState.selectedCategory === 'all') {
            textEl.innerText = 'Tutte le categorie';
            if (iconEl) iconEl.innerText = 'category';
        } else {
            textEl.innerText = productsTableState.selectedCategory;
            if (iconEl) iconEl.innerText = getCategoryIconName(productsTableState.selectedCategory);
        }
    }

    /**
     * Toggle open/close of Product Tab Category Filter dropdown.
     */
    function toggleProdCatDropdown(e) {
        if (e) e.stopPropagation();

        const panel = document.getElementById('rep-prod-cat-dropdown');
        const btn = document.getElementById('rep-prod-cat-select-btn');
        if (!panel || !btn) return;

        const wasOpen = (panel.style.display === 'flex');
        closeAllCompareDropdowns();

        if (!wasOpen) {
            panel.style.display = 'flex';
            btn.classList.add('open');

            const searchInput = document.getElementById('rep-prod-cat-search');
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 50);
            }
            renderProdCatDropdownOptions('');
        }
    }

    /**
     * Filter items in Product Tab Category Filter dropdown by search text.
     */
    function filterProdCatDropdownItems(query) {
        renderProdCatDropdownOptions(query);
    }

    /**
     * Select a category in Product Tab Category Filter.
     */
    function selectProdCatDropdownOption(catName) {
        productsTableState.selectedCategory = catName;
        updateProdCatButtonLabel();
        closeAllCompareDropdowns();
        filterReportsProductsList();
    }

    /* =========================================================================
       SINGLE PRODUCT DETAIL MODAL
       ========================================================================= */

    /**
     * Render the hourly sales wave chart inside the product detail modal.
     */
    function renderProductModalHourlyChart(hourlySales) {
        const container = document.getElementById('rep-prod-modal-chart-container');
        if (!container) return;

        if (!hourlySales || hourlySales.length === 0) {
            container.innerHTML = '<div class="empty-chart-text" style="padding-top: 40px;">Nessuna vendita registrata nelle fasce orarie</div>';
            return;
        }

        let maxOrders = 0;
        let peakSlot = '';
        hourlySales.forEach(slot => {
            if (slot.orders_count > maxOrders) {
                maxOrders = slot.orders_count;
                peakSlot = slot.hour_slot;
            }
        });

        const svgWidth = 600;
        const svgHeight = 110;
        const paddingX = 35;
        const paddingTop = 18;
        const paddingBottom = 16;

        const count = hourlySales.length;
        const usableWidth = svgWidth - (paddingX * 2);
        const usableHeight = svgHeight - paddingTop - paddingBottom;

        const points = hourlySales.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const ratio = maxOrders > 0 ? (slot.orders_count / maxOrders) : 0;
            const y = (svgHeight - paddingBottom) - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Monotone Spline / Cubic Bezier Path
        let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        if (points.length === 1) {
            linePath += ` L ${(points[0].x + 1).toFixed(1)} ${points[0].y.toFixed(1)}`;
        } else {
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i === 0 ? i : i - 1];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

                const cp1x = p1.x + (p2.x - p0.x) * 0.18;
                const cp1y = p1.y + (p2.y - p0.y) * 0.18;
                const cp2x = p2.x - (p3.x - p1.x) * 0.18;
                const cp2y = p2.y - (p3.y - p1.y) * 0.18;

                linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
            }
        }

        const firstX = points[0].x;
        const lastX = points[points.length - 1].x;
        const bottomY = svgHeight - paddingBottom + 8;
        const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

        const dotsHtml = points.map(pt => {
            const isPeak = (pt.slot.hour_slot === peakSlot && maxOrders > 0);
            const leftPct = (pt.x / svgWidth * 100).toFixed(2);
            const topPct = (pt.y / svgHeight * 100).toFixed(2);
            const orderText = pt.slot.orders_count === 1 ? '1 Ordine' : `${pt.slot.orders_count} Ordini (${pt.slot.qty} pz)`;
            const titleLabel = `Ore ${pt.slot.hour_slot}`;
            const revFormatted = formatCurrency(pt.slot.revenue);

            return `
                <div class="modal-chart-point-dot ${isPeak ? 'peak-dot' : ''}" 
                     style="left: ${leftPct}%; top: ${topPct}%;"
                     onmouseenter="showProdModalChartTooltip(event, '${escapeHtml(titleLabel)}', '${revFormatted}', '${orderText}')"
                     onmouseleave="hideProdModalChartTooltip()">
                </div>
            `;
        }).join('');

        const labelsHtml = points.map(pt => `
            <span class="wave-time-label" style="position: absolute; left: ${(pt.x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
                ${escapeHtml(pt.slot.hour_slot)}
            </span>
        `).join('');

        container.innerHTML = `
            <div style="position: relative; width: 100%; height: 110px;">
                <svg class="wave-svg" style="height: 110px;" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="prodModalWaveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.32" />
                            <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                        </linearGradient>
                    </defs>
                    <path class="wave-area-path" d="${areaPath}" style="fill:url(#prodModalWaveGradient);" />
                    <path class="wave-line-path" d="${linePath}" style="stroke:#2563eb;" />
                </svg>
                <div class="modal-wave-dots-wrap" style="height: 110px;">
                    ${dotsHtml}
                </div>
            </div>
            <div style="position: relative; width: 100%; height: 20px; margin-top: 4px;">
                ${labelsHtml}
            </div>
        `;
    }

    /**
     * Show custom tooltip for product modal wave chart.
     */
    function showProdModalChartTooltip(e, timeLabel, revenueText, orderText) {
        const tooltip = document.getElementById('rep-prod-modal-tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="reports-tooltip-time">${escapeHtml(timeLabel)}</div>
            <div class="reports-tooltip-val">
                <span class="material-symbols-rounded">payments</span>
                <span>${revenueText}</span>
            </div>
            <div class="reports-tooltip-sub">
                <span class="material-symbols-rounded" style="font-size:14px;">receipt_long</span>
                <span>${orderText}</span>
            </div>
        `;

        const dot = e.target;
        const parent = tooltip.offsetParent || tooltip.parentElement;
        if (dot && parent) {
            const dotRect = dot.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            const left = dotRect.left - parentRect.left + (dotRect.width / 2);
            const top = dotRect.top - parentRect.top - 8;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }

        tooltip.classList.add('visible');
    }

    /**
     * Hide custom tooltip for product modal wave chart.
     */
    function hideProdModalChartTooltip() {
        const tooltip = document.getElementById('rep-prod-modal-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    }

    /**
     * Render the events breakdown list inside the product detail modal.
     */
    function renderProductModalEvents(eventsBreakdown, totalProductRev) {
        const container = document.getElementById('rep-prod-modal-events-list');
        if (!container) return;

        if (!eventsBreakdown || eventsBreakdown.length === 0) {
            container.innerHTML = '<div style="color: var(--text-light); font-size: 0.86rem; text-align: center; padding: 12px;">Nessun evento associato alle vendite di questo prodotto</div>';
            return;
        }

        const maxRev = Number(totalProductRev) > 0 ? Number(totalProductRev) : 1;

        container.innerHTML = eventsBreakdown.map(ev => {
            const rev = Number(ev.revenue) || 0;
            const qty = Number(ev.qty) || 0;
            const pct = Math.min(100, Math.max(0, (rev / maxRev) * 100));

            return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; font-size: 0.88rem;">
                        <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(ev.sagra_name)}</span>
                        <div style="text-align: right;">
                            <span style="font-weight: 700; color: var(--primary); margin-right: 6px;">${formatCurrency(rev)}</span>
                            <span style="color: var(--text-light); font-size: 0.8rem;">(${qty} pz • ${pct.toFixed(1)}%)</span>
                        </div>
                    </div>
                    <div class="reports-progress-track" style="height: 6px; margin: 0;">
                        <div class="reports-progress-fill" style="width: ${Math.max(pct, rev > 0 ? 2 : 0)}%; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Open product detail modal.
     */
    async function openReportsProductModal(productName, overrideEventId = null, overrideEventName = null) {
        const modal = document.getElementById('reports-product-modal');
        if (!modal) return;

        document.getElementById('rep-prod-modal-title').innerText = productName;
        document.getElementById('rep-prod-modal-revenue').innerText = '...';
        document.getElementById('rep-prod-modal-qty').innerText = '...';
        document.getElementById('rep-prod-modal-price').innerText = '...';
        document.getElementById('rep-prod-modal-chart-container').innerHTML = '<div class="empty-chart-text" style="padding-top: 40px;"><span class="material-symbols-rounded spin">progress_activity</span> Caricamento andamento...</div>';
        document.getElementById('rep-prod-modal-events-list').innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-light);">Caricamento eventi...</div>';

        modal.style.display = 'flex';

        try {
            const params = new URLSearchParams();
            params.append('product_name', productName);
            if (reportsState.dateFilter.startDate) params.append('start_date', reportsState.dateFilter.startDate);
            if (reportsState.dateFilter.endDate) params.append('end_date', reportsState.dateFilter.endDate);
            
            const effectiveEventId = overrideEventId || (productsTableState.selectedEventId !== 'all' ? productsTableState.selectedEventId : null);
            if (effectiveEventId) {
                params.append('sagra_id', effectiveEventId);
            }

            const res = await fetch(`/api/reports/product-detail?${params.toString()}`);
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Errore nel caricamento del dettaglio piatto");
            }

            const p = data.product;
            const rev = Number(p.total_revenue) || 0;
            const qty = Number(p.total_qty) || 0;
            const avgPrice = Number(p.avg_price) || (qty > 0 ? rev / qty : 0);
            const cat = (p.category_name || 'Altro').trim();

            document.getElementById('rep-prod-modal-revenue').innerText = formatCurrency(rev);
            document.getElementById('rep-prod-modal-qty').innerText = `${qty.toLocaleString('it-IT')} pz`;
            document.getElementById('rep-prod-modal-price').innerText = formatCurrency(avgPrice);
            document.getElementById('rep-prod-modal-category').innerText = cat;
            document.getElementById('rep-prod-modal-scope-badge').innerText = overrideEventName
                ? overrideEventName
                : (productsTableState.selectedEventId === 'all'
                    ? 'Tutti gli eventi'
                    : (document.getElementById('rep-prod-event-select-text')?.innerText || 'Evento selezionato'));

            const catLower = cat.toLowerCase();
            let catIcon = 'restaurant';
            if (catLower === 'bevande' || catLower.includes('bar') || catLower.includes('drink') || catLower.includes('birr') || catLower.includes('vin')) {
                catIcon = 'local_bar';
            } else if (catLower === 'dolci' || catLower.includes('dessert')) {
                catIcon = 'cake';
            }
            const iconEl = document.getElementById('rep-prod-modal-icon');
            if (iconEl) iconEl.innerText = catIcon;

            renderProductModalHourlyChart(data.hourlySales);
            renderProductModalEvents(data.eventsBreakdown, rev);
        } catch (err) {
            console.error("Error opening product detail modal:", err);
            alert("Impossibile caricare i dettagli del piatto: " + err.message);
            closeReportsProductModal();
        }
    }

    /* =========================================================================
       INSPECT EVENT TAB (TAB 4: ISPEZIONE EVENTO)
       ========================================================================= */

    const inspectState = {
        selectedSagraId: null,
        sagraData: null,
        statsData: null,
        stockData: null,
        isLoading: false
    };

    /**
     * Initialize Inspect Event Tab
     */
    async function initInspectEventTab() {
        if (!eventsTableState.rawList || eventsTableState.rawList.length === 0) {
            try {
                const res = await fetch('/api/reports/overview');
                const data = await res.json();
                if (data.success && data.sagras) {
                    eventsTableState.rawList = data.sagras;
                }
            } catch (e) {}
        }

        const sagras = eventsTableState.rawList || [];
        if (!inspectState.selectedSagraId && sagras.length > 0) {
            inspectState.selectedSagraId = sagras[0].id;
        }

        renderInspectEventDropdownOptions(sagras, '');
        if (inspectState.selectedSagraId) {
            loadInspectEventData();
        }
    }

    /**
     * Toggle Inspect Event Dropdown
     */
    function toggleInspectEventDropdown(e) {
        if (e) e.stopPropagation();

        const panel = document.getElementById('rep-inspect-event-dropdown');
        const btn = document.getElementById('rep-inspect-event-select-btn');
        if (!panel || !btn) return;

        const wasOpen = (panel.style.display === 'flex');
        closeAllCompareDropdowns();

        if (!wasOpen) {
            panel.style.display = 'flex';
            btn.classList.add('open');

            const searchInput = document.getElementById('rep-inspect-event-search');
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 50);
            }
            renderInspectEventDropdownOptions(eventsTableState.rawList || [], '');
        }
    }

    /**
     * Filter Inspect Event Dropdown
     */
    function filterInspectEventDropdownItems(query) {
        renderInspectEventDropdownOptions(eventsTableState.rawList || [], query);
    }

    /**
     * Render Inspect Event Dropdown Options
     */
    function renderInspectEventDropdownOptions(sagrasList, query) {
        const container = document.getElementById('rep-inspect-event-options');
        if (!container) return;

        const cleanQuery = (query || '').trim().toLowerCase();
        let list = sagrasList || [];

        if (cleanQuery) {
            list = list.filter(s => s.name.toLowerCase().includes(cleanQuery));
        }

        if (list.length === 0) {
            container.innerHTML = '<div class="reports-dropdown-empty">Nessun evento trovato</div>';
            return;
        }

        container.innerHTML = list.map(s => {
            const isActive = String(inspectState.selectedSagraId) === String(s.id);
            const rev = Number(s.total_revenue) || 0;
            const revStr = formatCurrency(rev);

            return `
                <button type="button" class="reports-dropdown-option ${isActive ? 'active' : ''}" onclick="selectInspectEventDropdownOption(${s.id})">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--primary);">festival</span>
                        <span class="option-name font-bold" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                    </div>
                    <span class="reports-dropdown-option-right" style="font-size:0.75rem;">${revStr}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * Select an event in Inspect Event Tab
     */
    function selectInspectEventDropdownOption(id) {
        inspectState.selectedSagraId = id;
        closeAllCompareDropdowns();
        loadInspectEventData();
    }

    /**
     * Fetch and render all data for the selected event in Inspect Event Tab
     */
    async function loadInspectEventData() {
        const sagraId = inspectState.selectedSagraId;
        if (!sagraId) return;

        const refreshIcon = document.getElementById('rep-inspect-refresh-icon');
        const refreshBtn = document.getElementById('rep-inspect-refresh-btn');
        if (refreshIcon) refreshIcon.classList.add('spin');
        if (refreshBtn) refreshBtn.disabled = true;

        const sagras = eventsTableState.rawList || [];
        const sagra = sagras.find(s => String(s.id) === String(sagraId));

        const selectText = document.getElementById('rep-inspect-event-select-text');
        if (selectText) {
            selectText.innerText = sagra ? sagra.name : `Evento #${sagraId}`;
        }

        const dateBadge = document.getElementById('rep-inspect-event-date-text');
        if (dateBadge && sagra) {
            try {
                const d = new Date(sagra.created_at || Date.now());
                dateBadge.innerText = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            } catch(e) {
                dateBadge.innerText = 'Data N/D';
            }
        }

        // Show loading in KPI values
        const revEl = document.getElementById('rep-inspect-kpi-revenue');
        const ordEl = document.getElementById('rep-inspect-kpi-orders');
        const avgEl = document.getElementById('rep-inspect-kpi-avg-ticket');
        const qtyEl = document.getElementById('rep-inspect-kpi-qty');
        if (revEl) revEl.innerText = '...';
        if (ordEl) ordEl.innerText = '...';
        if (avgEl) avgEl.innerText = '...';
        if (qtyEl) qtyEl.innerText = '...';

        const chartContainer = document.getElementById('rep-inspect-hourly-chart');
        if (chartContainer) {
            chartContainer.innerHTML = '<div class="empty-chart-text" style="padding-top: 40px;"><span class="material-symbols-rounded spin">progress_activity</span> Caricamento andamento evento...</div>';
        }

        const dishesList = document.getElementById('rep-inspect-dishes-list');
        if (dishesList) {
            dishesList.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-light);"><span class="material-symbols-rounded spin">progress_activity</span> Caricamento piatti...</div>';
        }

        const stockList = document.getElementById('rep-inspect-stock-list');
        if (stockList) {
            stockList.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-light);"><span class="material-symbols-rounded spin">progress_activity</span> Caricamento scorte...</div>';
        }

        try {
            inspectState.isLoading = true;

            // Also refresh sagras list in background
            fetch('/api/reports/overview').then(r => r.json()).then(ov => {
                if (ov.success && ov.sagras) {
                    eventsTableState.rawList = ov.sagras;
                    renderInspectEventDropdownOptions(ov.sagras, '');
                }
            }).catch(() => {});

            const [statsRes, prodsRes] = await Promise.all([
                fetch(`/api/stats?sagraId=${sagraId}`),
                fetch(`/api/reports/products?sagra_id=${sagraId}`)
            ]);

            const statsData = await statsRes.json();
            const prodsData = await prodsRes.json();

            inspectState.statsData = statsData;
            inspectState.stockData = prodsData;

            const totalRev = Number(statsData.totalRevenue) || 0;
            const ordersCount = Number(statsData.ordersCount) || 0;
            const avgTicket = ordersCount > 0 ? totalRev / ordersCount : 0;

            let totalQty = 0;
            if (statsData.topItems && Array.isArray(statsData.topItems)) {
                statsData.topItems.forEach(item => {
                    totalQty += Number(item.qty) || 0;
                });
            }

            // Update KPI cards
            if (revEl) revEl.innerText = formatCurrency(totalRev);
            if (ordEl) ordEl.innerText = ordersCount.toLocaleString('it-IT');
            if (avgEl) avgEl.innerText = formatCurrency(avgTicket);
            if (qtyEl) qtyEl.innerText = `${totalQty.toLocaleString('it-IT')} pz`;

            // Render hourly chart
            renderInspectHourlyChart(statsData.hourlySales || []);

            // Render dishes list
            renderInspectDishesList(statsData.topItems || [], totalRev);

            // Render stock list
            renderInspectStockList(prodsData.products || [], prodsData.exhaustedProducts || [], prodsData.surplusProducts || []);

        } catch(err) {
            console.error("Error loading inspect event data:", err);
            if (chartContainer) chartContainer.innerHTML = `<div class="reports-empty-state" style="color:var(--danger);">Errore: ${escapeHtml(err.message)}</div>`;
        } finally {
            inspectState.isLoading = false;
            if (refreshIcon) refreshIcon.classList.remove('spin');
            if (refreshBtn) refreshBtn.disabled = false;
        }
    }

    /**
     * Render Hourly Sales Wave Chart for inspected event
     */
    function renderInspectHourlyChart(hourlySales) {
        const container = document.getElementById('rep-inspect-hourly-chart');
        const peakBadge = document.getElementById('rep-inspect-peak-badge');
        if (!container) return;

        if (!hourlySales || hourlySales.length === 0) {
            container.innerHTML = '<div class="empty-chart-text" style="padding-top: 40px;">Nessuna vendita oraria registrata per questo evento</div>';
            if (peakBadge) peakBadge.innerText = 'Picco: N/D';
            return;
        }

        // Fill gap hours between earliest and latest hour
        const slotMap = new Map();
        let minHour = 24;
        let maxHour = 0;

        hourlySales.forEach(s => {
            const h = parseInt(String(s.hour_slot).split(':')[0], 10);
            if (!isNaN(h)) {
                if (h < minHour) minHour = h;
                if (h > maxHour) maxHour = h;
                slotMap.set(s.hour_slot, s);
            }
        });

        const fullHourly = [];
        if (minHour <= maxHour) {
            for (let h = minHour; h <= maxHour; h++) {
                const key = `${String(h).padStart(2, '0')}:00`;
                fullHourly.push(slotMap.get(key) || {
                    hour_slot: key,
                    orders_count: 0,
                    revenue: 0
                });
            }
        } else {
            fullHourly.push(...hourlySales);
        }

        let maxRev = 0;
        let maxOrders = 0;
        let peakSlot = '';
        fullHourly.forEach(s => {
            const rev = Number(s.revenue) || 0;
            const ords = Number(s.orders_count) || 0;
            if (rev > maxRev) {
                maxRev = rev;
                peakSlot = s.hour_slot;
            }
            if (ords > maxOrders) maxOrders = ords;
        });

        if (peakBadge) {
            peakBadge.innerText = peakSlot ? `Picco: Ore ${peakSlot} (${formatCurrency(maxRev)})` : 'Picco: --:--';
        }

        const count = fullHourly.length;
        const svgWidth = 800;
        const svgHeight = 140;
        const paddingLeft = 40;
        const paddingRight = 40;
        const paddingTop = 20;
        const paddingBottom = 25;
        const chartAreaWidth = svgWidth - paddingLeft - paddingRight;
        const chartAreaHeight = svgHeight - paddingTop - paddingBottom;

        const baselineY = svgHeight - paddingBottom;

        const points = fullHourly.map((slot, index) => {
            const rev = Number(slot.revenue) || 0;
            const x = count === 1
                ? paddingLeft + chartAreaWidth / 2
                : paddingLeft + (index / (count - 1)) * chartAreaWidth;
            const normalizedY = maxRev > 0 ? rev / maxRev : 0;
            const y = baselineY - (normalizedY * chartAreaHeight);
            return { x, y, slot };
        });

        let linePath = '';
        if (points.length === 1) {
            linePath = `M ${paddingLeft} ${points[0].y} L ${svgWidth - paddingRight} ${points[0].y}`;
        } else {
            linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = i > 0 ? points[i - 1] : points[i];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = i < points.length - 2 ? points[i + 2] : p2;

                const r1 = Number(p1.slot.revenue) || 0;
                const r2 = Number(p2.slot.revenue) || 0;

                if (r1 === 0 && r2 === 0) {
                    linePath += ` L ${p2.x.toFixed(1)} ${baselineY.toFixed(1)}`;
                } else {
                    let cp1x = p1.x + (p2.x - p0.x) * 0.18;
                    let cp1y = p1.y + (p2.y - p0.y) * 0.18;
                    let cp2x = p2.x - (p3.x - p1.x) * 0.18;
                    let cp2y = p2.y - (p3.y - p1.y) * 0.18;

                    if (r1 === 0) cp1y = baselineY;
                    if (r2 === 0) cp2y = baselineY;

                    cp1y = Math.max(paddingTop, Math.min(baselineY, cp1y));
                    cp2y = Math.max(paddingTop, Math.min(baselineY, cp2y));

                    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
                }
            }
        }

        const firstX = points[0].x;
        const lastX = points[points.length - 1].x;
        const areaPath = `${linePath} L ${lastX.toFixed(1)} ${baselineY} L ${firstX.toFixed(1)} ${baselineY} Z`;

        const dotsHtml = points.map(pt => {
            const rev = Number(pt.slot.revenue) || 0;
            const orders = Number(pt.slot.orders_count) || 0;
            if (orders === 0 && rev === 0) return '';

            const isPeak = (pt.slot.hour_slot === peakSlot && maxRev > 0);
            const leftPct = (pt.x / svgWidth * 100).toFixed(2);
            const topPct = (pt.y / svgHeight * 100).toFixed(2);
            const orderText = pt.slot.orders_count === 1 ? '1 Ordine' : `${pt.slot.orders_count} Ordini`;
            const titleLabel = `Ore ${pt.slot.hour_slot}`;
            const revFormatted = formatCurrency(pt.slot.revenue);

            return `
                <div class="modal-chart-point-dot ${isPeak ? 'peak-dot' : ''}" 
                     style="left: ${leftPct}%; top: ${topPct}%;"
                     onmouseenter="showInspectChartTooltip(event, '${escapeHtml(titleLabel)}', '${revFormatted}', '${orderText}')"
                     onmouseleave="hideInspectChartTooltip()">
                </div>
            `;
        }).join('');

        const labelsHtml = points.map(pt => `
            <span class="wave-time-label" style="position: absolute; left: ${(pt.x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
                ${escapeHtml(pt.slot.hour_slot)}
            </span>
        `).join('');

        container.innerHTML = `
            <div style="position: relative; width: 100%; height: 130px;">
                <svg class="wave-svg" style="height: 130px;" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="inspectWaveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.30" />
                            <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                        </linearGradient>
                    </defs>
                    <path class="wave-area-path" d="${areaPath}" style="fill:url(#inspectWaveGradient);" />
                    <path class="wave-line-path" d="${linePath}" style="stroke:#2563eb;" />
                </svg>
                <div class="modal-wave-dots-wrap" style="height: 130px;">
                    ${dotsHtml}
                </div>
            </div>
            <div style="position: relative; width: 100%; height: 20px; margin-top: 4px;">
                ${labelsHtml}
            </div>
        `;
    }

    /**
     * Show custom tooltip for inspect event hourly chart
     */
    function showInspectChartTooltip(e, timeLabel, revenueText, orderText) {
        const tooltip = document.getElementById('rep-inspect-hourly-tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="reports-tooltip-time">${escapeHtml(timeLabel)}</div>
            <div class="reports-tooltip-val">
                <span class="material-symbols-rounded">payments</span>
                <span>${revenueText}</span>
            </div>
            <div class="reports-tooltip-sub">
                <span class="material-symbols-rounded" style="font-size:14px;">receipt_long</span>
                <span>${orderText}</span>
            </div>
        `;

        const dot = e.target;
        const parent = tooltip.offsetParent || tooltip.parentElement;
        if (dot && parent) {
            const dotRect = dot.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            const left = dotRect.left - parentRect.left + (dotRect.width / 2);
            const top = dotRect.top - parentRect.top - 8;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }

        tooltip.classList.add('visible');
    }

    /**
     * Hide custom tooltip for inspect event hourly chart
     */
    function hideInspectChartTooltip() {
        const tooltip = document.getElementById('rep-inspect-hourly-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    }

    /**
     * Render dishes list in inspect event tab
     */
    function renderInspectDishesList(topItems, totalEventRev) {
        const container = document.getElementById('rep-inspect-dishes-list');
        const countBadge = document.getElementById('rep-inspect-dishes-count');
        if (!container) return;

        if (!topItems || topItems.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--text-light); font-size: 0.88rem;">Nessun piatto venduto in questo evento</div>';
            if (countBadge) countBadge.innerText = '0 piatti';
            return;
        }

        if (countBadge) countBadge.innerText = `${topItems.length} ${topItems.length === 1 ? 'piatto' : 'piatti'}`;

        const maxQty = Number(topItems[0]?.qty) || 1;

        container.innerHTML = topItems.map((item, idx) => {
            const rank = idx + 1;
            const qty = Number(item.qty) || 0;
            const rev = Number(item.revenue) || 0;
            const cat = (item.category_name || 'Altro').trim();
            const pct = maxQty > 0 ? Math.min(100, Math.max(0, (qty / maxQty) * 100)) : 0;

            return `
                <div class="reports-topflop-item" onclick="openReportsProductModal('${escapeHtml(item.product_name)}', ${inspectState.selectedSagraId})" title="Clicca per statistiche piatto">
                    <div class="reports-topflop-rank rank-other">${rank}</div>
                    <div class="reports-topflop-info">
                        <div class="reports-topflop-name-row">
                            <span class="reports-topflop-name">${escapeHtml(item.product_name)}</span>
                            <span class="reports-topflop-rev" style="color: var(--text-main); font-weight: 800;">${qty.toLocaleString('it-IT')} pz</span>
                        </div>
                        <div class="reports-topflop-sub-row">
                            <span>${escapeHtml(cat)} • ${formatCurrency(rev)}</span>
                            <div class="reports-topflop-track" style="max-width: 90px;">
                                <div class="reports-topflop-bar" style="width: ${Math.max(pct, qty > 0 ? 4 : 0)}%; background: linear-gradient(90deg, #64748b, #94a3b8);"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render stock movements and out of stock items in inspect event tab
     */
    function renderInspectStockList(allProds, exhaustedProds, surplusProds) {
        const container = document.getElementById('rep-inspect-stock-list');
        const countBadge = document.getElementById('rep-inspect-stock-count');
        if (!container) return;

        const stockItems = [...(exhaustedProds || []), ...(surplusProds || [])];

        if (stockItems.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 24px; color: var(--text-light);">
                    <span class="material-symbols-rounded" style="font-size: 28px; color: var(--text-light); display: block; margin-bottom: 4px;">inventory_2</span>
                    <strong style="color: var(--text-main); font-size: 0.88rem;">Nessuna giacenza limitata</strong>
                    <div style="font-size: 0.78rem; margin-top: 2px;">Tutti i prodotti di questo evento erano a disponibilità illimitata.</div>
                </div>
            `;
            if (countBadge) countBadge.innerText = '0 tracciati';
            return;
        }

        if (countBadge) countBadge.innerText = `${stockItems.length} tracciati`;

        container.innerHTML = stockItems.map((p, idx) => {
            const rank = idx + 1;
            const remaining = Number(p.remaining_stock) || 0;
            const soldQty = Number(p.total_sold_qty) || 0;
            const cat = (p.category_name || 'Altro').trim();
            const isExhausted = remaining <= 0;

            let statusSub = '';
            let ochreDot = '';

            if (isExhausted) {
                ochreDot = `<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #d97706; margin-left: 6px; vertical-align: middle;" title="Prodotto Esaurito"></span>`;
                let timeStr = 'Esaurito';
                if (p.exhausted_at) {
                    try {
                        const d = new Date(p.exhausted_at);
                        timeStr = `Esaurito ore ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    } catch(e){}
                }
                statusSub = `<span style="font-weight: 600; color: var(--text-light);">${soldQty} venduti (${timeStr})</span>`;
            } else {
                const unsoldPct = Number(p.unsold_pct) || 0;
                statusSub = `<span style="font-weight: 600; color: var(--text-light);">${soldQty} venduti (${unsoldPct}% invenduto)</span>`;
            }

            return `
                <div class="reports-topflop-item" onclick="openReportsProductModal('${escapeHtml(p.product_name)}', ${p.sagra_id})" title="Clicca per statistiche piatto">
                    <div class="reports-topflop-rank rank-other">${rank}</div>
                    <div class="reports-topflop-info">
                        <div class="reports-topflop-name-row">
                            <span class="reports-topflop-name">${escapeHtml(p.product_name)}${ochreDot}</span>
                            <span class="reports-topflop-rev" style="color: var(--text-main); font-weight: 700;">
                                ${remaining} pz rimasti
                            </span>
                        </div>
                        <div class="reports-topflop-sub-row">
                            <span>${escapeHtml(cat)}</span>
                            ${statusSub}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Close product detail modal.
     */
    function closeReportsProductModal() {
        const modal = document.getElementById('reports-product-modal');
        if (modal) modal.style.display = 'none';
    }

    // Expose global functions to window
    window.openReportsView = openReportsView;
    window.closeReportsView = closeReportsView;
    window.switchReportsTab = switchReportsTab;
    window.changeReportsTimelinePeriod = changeReportsTimelinePeriod;
    window.showReportsChartTooltip = showReportsChartTooltip;
    window.hideReportsChartTooltip = hideReportsChartTooltip;
    window.showCompareChartTooltip = showCompareChartTooltip;
    window.hideCompareChartTooltip = hideCompareChartTooltip;
    window.openReportsDateRangeModal = openReportsDateRangeModal;
    window.closeReportsDateRangeModal = closeReportsDateRangeModal;
    window.selectReportsPreset = selectReportsPreset;
    window.onCustomDateInputChanged = onCustomDateInputChanged;
    window.applyReportsDateFilter = applyReportsDateFilter;
    window.filterReportsEventsList = filterReportsEventsList;
    window.openEventStatsModal = openEventStatsModal;
    window.sortReportsEventsBy = sortReportsEventsBy;
    window.handleEventsTableScroll = handleEventsTableScroll;
    window.toggleCompareDropdown = toggleCompareDropdown;
    window.filterCompareDropdownItems = filterCompareDropdownItems;
    window.selectCompareDropdownOption = selectCompareDropdownOption;
    window.loadProductsBreakdown = loadProductsBreakdown;
    window.filterReportsProductsList = filterReportsProductsList;
    window.sortReportsProductsBy = sortReportsProductsBy;
    window.handleProductsTableScroll = handleProductsTableScroll;
    window.toggleProdEventDropdown = toggleProdEventDropdown;
    window.filterProdEventDropdownItems = filterProdEventDropdownItems;
    window.selectProdEventDropdownOption = selectProdEventDropdownOption;
    window.toggleProdCatDropdown = toggleProdCatDropdown;
    window.filterProdCatDropdownItems = filterProdCatDropdownItems;
    window.selectProdCatDropdownOption = selectProdCatDropdownOption;
    window.openReportsProductModal = openReportsProductModal;
    window.closeReportsProductModal = closeReportsProductModal;
    window.showProdModalChartTooltip = showProdModalChartTooltip;
    window.hideProdModalChartTooltip = hideProdModalChartTooltip;
    window.toggleInspectEventDropdown = toggleInspectEventDropdown;
    window.filterInspectEventDropdownItems = filterInspectEventDropdownItems;
    window.selectInspectEventDropdownOption = selectInspectEventDropdownOption;
    window.loadInspectEventData = loadInspectEventData;
    window.showInspectChartTooltip = showInspectChartTooltip;
    window.hideInspectChartTooltip = hideInspectChartTooltip;
})();
