/**
 * KBO 스케줄러 - Frontend Application Logic
 * Interacts with Flask REST API
 */

document.addEventListener('DOMContentLoaded', () => {
    // Current Filter State
    const state = {
        status: 'all',
        team: 'all',
        search: ''
    };

    let TEAMS = {}; // name -> { stadium, color }

    // DOM Elements
    const todoListContainer = document.getElementById('todo-list-container');
    const createForm = document.getElementById('create-game-form');
    const homeSelect = document.getElementById('game-home-select');
    const awaySelect = document.getElementById('game-away-select');
    const dateInput = document.getElementById('game-date-input');
    const timeInput = document.getElementById('game-time-input');
    const stadiumInput = document.getElementById('game-stadium-input');
    const statusSelect = document.getElementById('game-status-select');
    const broadcastInput = document.getElementById('game-broadcast-input');
    const memoInput = document.getElementById('game-memo-input');

    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statScheduled = document.getElementById('stat-scheduled');
    const statLive = document.getElementById('stat-live');
    const statFinished = document.getElementById('stat-finished');
    const statToday = document.getElementById('stat-today');

    // Filter Elements
    const filterTabs = document.querySelectorAll('.filter-tab');
    const filterTeamSelect = document.getElementById('filter-team-select');
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-game-form');
    const editIdInput = document.getElementById('edit-game-id');
    const editHomeSelect = document.getElementById('edit-home-select');
    const editAwaySelect = document.getElementById('edit-away-select');
    const editDateInput = document.getElementById('edit-date-input');
    const editTimeInput = document.getElementById('edit-time-input');
    const editStadiumInput = document.getElementById('edit-stadium-input');
    const editStatusSelect = document.getElementById('edit-status-select');
    const editBroadcastInput = document.getElementById('edit-broadcast-input');
    const editHomeScoreInput = document.getElementById('edit-home-score-input');
    const editAwayScoreInput = document.getElementById('edit-away-score-input');
    const editMemoInput = document.getElementById('edit-memo-input');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Display current date in Korean format
    const currentDateEl = document.getElementById('current-date-display');
    if (currentDateEl) {
        const now = new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const formatted = `${now.getFullYear()}. ${(now.getMonth() + 1).toString().padStart(2, '0')}. ${now.getDate().toString().padStart(2, '0')} (${days[now.getDay()]})`;
        currentDateEl.textContent = formatted;
    }

    // Set default date to today in create form
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateInput) dateInput.value = todayStr;

    // Toast Notification helper
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? '✓' : '⚠️';
        toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Utility: HTML escape
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function teamColor(name) {
        return (TEAMS[name] && TEAMS[name].color) || '#6366f1';
    }

    // Load Teams from API and populate selects
    async function loadTeams() {
        try {
            const res = await fetch('/api/teams');
            if (!res.ok) throw new Error('구단 정보 로드 실패');
            const teams = await res.json();
            teams.forEach(t => { TEAMS[t.name] = { stadium: t.stadium, color: t.color }; });

            const optionsHtml = teams.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
            [homeSelect, awaySelect, editHomeSelect, editAwaySelect].forEach(sel => {
                sel.innerHTML = optionsHtml;
            });

            filterTeamSelect.innerHTML = '<option value="all">전체 구단</option>' + optionsHtml;

            if (homeSelect.options.length > 1) awaySelect.selectedIndex = 1;
            stadiumInput.value = TEAMS[homeSelect.value]?.stadium || '';
        } catch (err) {
            console.error('Teams loading error:', err);
        }
    }

    homeSelect?.addEventListener('change', () => {
        stadiumInput.value = TEAMS[homeSelect.value]?.stadium || '';
    });

    editHomeSelect?.addEventListener('change', () => {
        editStadiumInput.value = TEAMS[editHomeSelect.value]?.stadium || '';
    });

    // Load Stats from API
    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            if (!res.ok) throw new Error('통계 로드 실패');
            const data = await res.json();

            statTotal.textContent = data.total;
            statScheduled.textContent = data.scheduled;
            statLive.textContent = data.live;
            statFinished.textContent = data.finished;
            statToday.textContent = data.today;
        } catch (err) {
            console.error('Stats loading error:', err);
        }
    }

    // Load Games from API
    async function loadGames() {
        try {
            const params = new URLSearchParams();
            if (state.status !== 'all') params.append('status', state.status);
            if (state.team !== 'all') params.append('team', state.team);
            if (state.search.trim()) params.append('search', state.search.trim());

            const url = `/api/games?${params.toString()}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('경기 목록 조회 실패');
            const games = await res.json();

            renderGameList(games);
            loadStats();
        } catch (err) {
            console.error('Games fetch error:', err);
            todoListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">경기 일정을 불러오는 중 오류가 발생했습니다.</div>
                    <p style="font-size: 0.85rem; color: #ef4444;">${escapeHtml(err.message)}</p>
                </div>
            `;
        }
    }

    const STATUS_META = {
        '예정':   { icon: '🗓️', cls: 'scheduled' },
        '진행중': { icon: '🔴', cls: 'live' },
        '종료':   { icon: '🏁', cls: 'finished' },
    };

    // Render Game Cards
    function renderGameList(games) {
        if (!games || games.length === 0) {
            todoListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚾</div>
                    <div class="empty-title">표시할 경기 일정이 없습니다</div>
                    <p>새로운 경기를 등록하거나 필터 조건을 변경해 보세요.</p>
                </div>
            `;
            return;
        }

        const cardsHtml = games.map(game => {
            const meta = STATUS_META[game.status] || { icon: '🗓️', cls: 'scheduled' };
            const hasScore = game.home_score !== null && game.home_score !== undefined &&
                              game.away_score !== null && game.away_score !== undefined;
            const scoreHtml = hasScore
                ? `<span class="score-value">${game.home_score} : ${game.away_score}</span>`
                : `<span class="score-value score-pending">- : -</span>`;

            return `
                <article class="todo-card game-card ${meta.cls}" id="todo-card-${game.id}" data-id="${game.id}">
                    <div class="game-status-rail" style="background:${teamColor(game.home_team)}"></div>

                    <div class="todo-content">
                        <div class="todo-header-line">
                            <span class="badge badge-status-${meta.cls}">${meta.icon} ${escapeHtml(game.status)}</span>
                            <span class="meta-date-time">📅 ${escapeHtml(game.game_date)} ${escapeHtml(game.game_time || '')}</span>
                            ${game.broadcast ? `<span class="badge badge-category">📺 ${escapeHtml(game.broadcast)}</span>` : ''}
                        </div>

                        <div class="matchup-row">
                            <span class="team-pill" style="--team-color:${teamColor(game.home_team)}">${escapeHtml(game.home_team)}</span>
                            ${scoreHtml}
                            <span class="team-pill away" style="--team-color:${teamColor(game.away_team)}">${escapeHtml(game.away_team)}</span>
                        </div>

                        ${game.memo ? `<p class="todo-description">${escapeHtml(game.memo)}</p>` : ''}

                        <div class="todo-footer-meta">
                            <span class="meta-created">🏟️ ${escapeHtml(game.stadium || '미정')}</span>
                        </div>
                    </div>

                    <div class="todo-actions">
                        <button type="button" class="action-btn cycle-btn" id="btn-cycle-${game.id}" title="다음 상태로 변경">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                        </button>
                        <button type="button" class="action-btn edit-btn" id="btn-edit-${game.id}" title="경기 정보 수정">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button type="button" class="action-btn delete-btn" id="btn-delete-${game.id}" title="경기 일정 삭제">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        todoListContainer.innerHTML = cardsHtml;

        // Attach event listeners to newly generated cards
        games.forEach(game => {
            const card = document.getElementById(`todo-card-${game.id}`);
            const cycleBtn = card.querySelector('.cycle-btn');
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');

            cycleBtn.addEventListener('click', () => handleCycleStatus(game.id));
            editBtn.addEventListener('click', () => openEditModal(game));
            deleteBtn.addEventListener('click', () => handleDeleteGame(game.id, `${game.home_team} vs ${game.away_team}`));
        });
    }

    // Add New Game
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const home_team = homeSelect.value;
        const away_team = awaySelect.value;
        if (home_team === away_team) {
            showToast('홈팀과 원정팀은 서로 달라야 합니다.', 'error');
            return;
        }

        const newGameData = {
            home_team,
            away_team,
            game_date: dateInput.value,
            game_time: timeInput.value,
            stadium: stadiumInput.value.trim(),
            status: statusSelect.value,
            broadcast: broadcastInput.value.trim(),
            memo: memoInput.value.trim(),
        };

        try {
            const res = await fetch('/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newGameData)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '경기 등록 실패');
            }

            memoInput.value = '';
            broadcastInput.value = '';

            showToast('새로운 경기 일정이 추가되었습니다!');
            loadGames();
        } catch (err) {
            console.error('Create game error:', err);
            showToast(err.message, 'error');
        }
    });

    // Cycle Status (예정 -> 진행중 -> 종료 -> 예정)
    async function handleCycleStatus(id) {
        try {
            const res = await fetch(`/api/games/${id}/status`, { method: 'PATCH' });
            if (!res.ok) throw new Error('상태 변경 실패');
            const updated = await res.json();
            showToast(`경기 상태가 "${updated.status}"(으)로 변경되었습니다.`);
            loadGames();
        } catch (err) {
            console.error('Status cycle error:', err);
            showToast(err.message, 'error');
        }
    }

    // Delete Game
    async function handleDeleteGame(id, label) {
        if (!confirm(`"${label}" 경기 일정을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/games/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('삭제 처리 실패');
            showToast('경기 일정이 삭제되었습니다.');
            loadGames();
        } catch (err) {
            console.error('Delete error:', err);
            showToast(err.message, 'error');
        }
    }

    // Open Edit Modal
    function openEditModal(game) {
        editIdInput.value = game.id;
        editHomeSelect.value = game.home_team;
        editAwaySelect.value = game.away_team;
        editDateInput.value = game.game_date;
        editTimeInput.value = game.game_time || '';
        editStadiumInput.value = game.stadium || '';
        editStatusSelect.value = game.status || '예정';
        editBroadcastInput.value = game.broadcast || '';
        editHomeScoreInput.value = game.home_score ?? '';
        editAwayScoreInput.value = game.away_score ?? '';
        editMemoInput.value = game.memo || '';

        editModal.style.display = 'flex';
    }

    function closeEditModal() {
        editModal.style.display = 'none';
        editForm.reset();
    }

    btnCloseModal.addEventListener('click', closeEditModal);
    btnCancelEdit.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // Save Edit Form
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editIdInput.value;
        const updatedData = {
            home_team: editHomeSelect.value,
            away_team: editAwaySelect.value,
            game_date: editDateInput.value,
            game_time: editTimeInput.value,
            stadium: editStadiumInput.value.trim(),
            status: editStatusSelect.value,
            broadcast: editBroadcastInput.value.trim(),
            home_score: editHomeScoreInput.value,
            away_score: editAwayScoreInput.value,
            memo: editMemoInput.value.trim(),
        };

        try {
            const res = await fetch(`/api/games/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!res.ok) throw new Error('수정 저장 실패');
            showToast('경기 일정이 성공적으로 수정되었습니다.');
            closeEditModal();
            loadGames();
        } catch (err) {
            console.error('Edit submit error:', err);
            showToast(err.message, 'error');
        }
    });

    // Filter Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.status = tab.dataset.status;
            loadGames();
        });
    });

    // Team Filter
    filterTeamSelect.addEventListener('change', (e) => {
        state.team = e.target.value;
        loadGames();
    });

    // Search Input with Debounce
    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        btnClearSearch.style.display = val.length > 0 ? 'block' : 'none';

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            state.search = val;
            loadGames();
        }, 250);
    });

    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        btnClearSearch.style.display = 'none';
        loadGames();
    });

    // Initial Load
    loadTeams().then(loadGames);
});
