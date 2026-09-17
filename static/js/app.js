/**
 * TaskPulse - Frontend Application Logic
 * Interacts with Flask REST API
 */

document.addEventListener('DOMContentLoaded', () => {
    // Current Filter State
    const state = {
        status: 'all',
        priority: 'all',
        category: 'all',
        search: ''
    };

    // DOM Elements
    const todoListContainer = document.getElementById('todo-list-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const createForm = document.getElementById('create-todo-form');
    const titleInput = document.getElementById('todo-title-input');
    const descInput = document.getElementById('todo-desc-input');
    const prioritySelect = document.getElementById('todo-priority-select');
    const categoryInput = document.getElementById('todo-category-input');
    const dueDateInput = document.getElementById('todo-due-date-input');

    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statActive = document.getElementById('stat-active');
    const statCompleted = document.getElementById('stat-completed');
    const statRate = document.getElementById('stat-rate');
    const statProgressBar = document.getElementById('stat-progress-bar');

    // Filter Elements
    const filterTabs = document.querySelectorAll('.filter-tab');
    const filterPrioritySelect = document.getElementById('filter-priority-select');
    const filterCategorySelect = document.getElementById('filter-category-select');
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-todo-form');
    const editIdInput = document.getElementById('edit-todo-id');
    const editTitleInput = document.getElementById('edit-todo-title');
    const editDescInput = document.getElementById('edit-todo-desc');
    const editPrioritySelect = document.getElementById('edit-todo-priority');
    const editCategoryInput = document.getElementById('edit-todo-category');
    const editDueDateInput = document.getElementById('edit-todo-due-date');
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

    // Set default due date to today in form
    const todayStr = new Date().toISOString().split('T')[0];
    if (dueDateInput) {
        dueDateInput.value = todayStr;
    }

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

    // Load Stats from API
    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            if (!res.ok) throw new Error('통계 로드 실패');
            const data = await res.json();

            statTotal.textContent = data.total;
            statActive.textContent = data.active;
            statCompleted.textContent = data.completed;
            statRate.textContent = `${data.rate}%`;
            statProgressBar.style.width = `${data.rate}%`;

            // Update category dropdown options
            const currentSelected = filterCategorySelect.value;
            filterCategorySelect.innerHTML = '<option value="all">카테고리 전체</option>';
            if (data.categories && data.categories.length > 0) {
                data.categories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if (cat === currentSelected) opt.selected = true;
                    filterCategorySelect.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Stats loading error:', err);
        }
    }

    // Load Todos from API
    async function loadTodos() {
        try {
            const params = new URLSearchParams();
            if (state.status !== 'all') params.append('status', state.status);
            if (state.priority !== 'all') params.append('priority', state.priority);
            if (state.category !== 'all') params.append('category', state.category);
            if (state.search.trim()) params.append('search', state.search.trim());

            const url = `/api/todos?${params.toString()}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('목록 조회 실패');
            const todos = await res.json();

            renderTodoList(todos);
            loadStats();
        } catch (err) {
            console.error('Todos fetch error:', err);
            todoListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">할 일 목록을 불러오는 중 오류가 발생했습니다.</div>
                    <p style="font-size: 0.85rem; color: #ef4444;">${escapeHtml(err.message)}</p>
                </div>
            `;
        }
    }

    // Render Todo Cards
    function renderTodoList(todos) {
        if (!todos || todos.length === 0) {
            todoListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✨</div>
                    <div class="empty-title">표시할 할 일이 없습니다</div>
                    <p>새로운 할 일을 추가하거나 필터 조건을 변경해 보세요.</p>
                </div>
            `;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        const cardsHtml = todos.map(todo => {
            const isCompleted = todo.completed === 1;
            const priorityLabel = {
                high: '🔴 높음',
                medium: '🟡 중간',
                low: '🟢 낮음'
            }[todo.priority] || todo.priority;

            const isOverdue = !isCompleted && todo.due_date && todo.due_date < today;

            return `
                <article class="todo-card ${isCompleted ? 'completed' : ''}" id="todo-card-${todo.id}" data-id="${todo.id}">
                    <div class="checkbox-container" title="${isCompleted ? '미완료로 변경' : '완료로 변경'}">
                        <div class="custom-checkbox" id="check-box-${todo.id}">
                            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    </div>

                    <div class="todo-content">
                        <div class="todo-header-line">
                            <h3 class="todo-title">${escapeHtml(todo.title)}</h3>
                            <span class="badge badge-priority-${escapeHtml(todo.priority)}">${priorityLabel}</span>
                            ${todo.category ? `<span class="badge badge-category">📁 ${escapeHtml(todo.category)}</span>` : ''}
                        </div>

                        ${todo.description ? `<p class="todo-description">${escapeHtml(todo.description)}</p>` : ''}

                        <div class="todo-footer-meta">
                            ${todo.due_date ? `
                                <span class="meta-due-date ${isOverdue ? 'overdue' : ''}">
                                    📅 목표일: ${escapeHtml(todo.due_date)} ${isOverdue ? '(기한 초과)' : ''}
                                </span>
                            ` : ''}
                            <span class="meta-created">등록: ${escapeHtml(todo.created_at.substring(0, 10))}</span>
                        </div>
                    </div>

                    <div class="todo-actions">
                        <button type="button" class="action-btn edit-btn" id="btn-edit-${todo.id}" title="할 일 수정">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button type="button" class="action-btn delete-btn" id="btn-delete-${todo.id}" title="할 일 삭제">
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
        todos.forEach(todo => {
            const card = document.getElementById(`todo-card-${todo.id}`);
            const checkbox = card.querySelector('.checkbox-container');
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');

            checkbox.addEventListener('click', () => handleToggleTodo(todo.id));
            editBtn.addEventListener('click', () => openEditModal(todo));
            deleteBtn.addEventListener('click', () => handleDeleteTodo(todo.id, todo.title));
        });
    }

    // Add New Todo
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        if (!title) return;

        const newTodoData = {
            title: title,
            description: descInput.value.trim(),
            priority: prioritySelect.value,
            category: categoryInput.value.trim() || '일반',
            due_date: dueDateInput.value
        };

        try {
            const res = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTodoData)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '할 일 등록 실패');
            }

            // Reset form fields
            titleInput.value = '';
            descInput.value = '';
            titleInput.focus();

            showToast('새로운 할 일이 추가되었습니다!');
            loadTodos();
        } catch (err) {
            console.error('Create todo error:', err);
            showToast(err.message, 'error');
        }
    });

    // Toggle Complete
    async function handleToggleTodo(id) {
        try {
            const res = await fetch(`/api/todos/${id}/toggle`, { method: 'PATCH' });
            if (!res.ok) throw new Error('상태 변경 실패');
            const updated = await res.json();
            const msg = updated.completed === 1 ? '할 일을 완료했습니다! 🎉' : '할 일을 다시 진행 중으로 변경했습니다.';
            showToast(msg);
            loadTodos();
        } catch (err) {
            console.error('Toggle error:', err);
            showToast(err.message, 'error');
        }
    }

    // Delete Todo
    async function handleDeleteTodo(id, title) {
        if (!confirm(`"${title}" 항목을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('삭제 처리 실패');
            showToast('할 일이 삭제되었습니다.');
            loadTodos();
        } catch (err) {
            console.error('Delete error:', err);
            showToast(err.message, 'error');
        }
    }

    // Open Edit Modal
    function openEditModal(todo) {
        editIdInput.value = todo.id;
        editTitleInput.value = todo.title;
        editDescInput.value = todo.description || '';
        editPrioritySelect.value = todo.priority || 'medium';
        editCategoryInput.value = todo.category || '';
        editDueDateInput.value = todo.due_date || '';

        editModal.style.display = 'flex';
        editTitleInput.focus();
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
            title: editTitleInput.value.trim(),
            description: editDescInput.value.trim(),
            priority: editPrioritySelect.value,
            category: editCategoryInput.value.trim() || '일반',
            due_date: editDueDateInput.value
        };

        try {
            const res = await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!res.ok) throw new Error('수정 저장 실패');
            showToast('할 일 내용이 성공적으로 수정되었습니다.');
            closeEditModal();
            loadTodos();
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
            loadTodos();
        });
    });

    // Priority Filter
    filterPrioritySelect.addEventListener('change', (e) => {
        state.priority = e.target.value;
        loadTodos();
    });

    // Category Filter
    filterCategorySelect.addEventListener('change', (e) => {
        state.category = e.target.value;
        loadTodos();
    });

    // Search Input with Debounce
    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        btnClearSearch.style.display = val.length > 0 ? 'block' : 'none';

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            state.search = val;
            loadTodos();
        }, 250);
    });

    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        btnClearSearch.style.display = 'none';
        loadTodos();
    });

    // Initial Load
    loadTodos();
});
