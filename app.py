import os
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'todos.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            category TEXT DEFAULT '업무',
            due_date TEXT,
            completed INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')
    
    # 기본 초기 데이터 확인 및 추가
    cursor.execute('SELECT COUNT(*) FROM todos')
    count = cursor.fetchone()[0]
    if count == 0:
        sample_todos = [
            (
                'Flask 할일 관리 웹앱 런칭 완료하기',
                '현대적인 글래스모피즘 UI와 SQLite 연동 확인',
                'high',
                '프로젝트',
                datetime.now().strftime('%Y-%m-%d'),
                1,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ),
            (
                '팀 주간 스프린트 회의 준비',
                '진행 상황 공유 및 이번 주 핵심 목표 점검',
                'high',
                '업무',
                datetime.now().strftime('%Y-%m-%d'),
                0,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ),
            (
                'AI 에이전트 자동화 워크플로우 문서 검토',
                'Excel 및 Python 스크립트 연동 가이드 작성',
                'medium',
                '연구',
                datetime.now().strftime('%Y-%m-%d'),
                0,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ),
            (
                '건강을 위한 매일 물 2L 마시기 & 스트레칭',
                '장시간 개발 작업 중 1시간마다 가벼운 스트레칭',
                'low',
                '개인',
                '',
                0,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            )
        ]
        cursor.executemany('''
            INSERT INTO todos (title, description, priority, category, due_date, completed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', sample_todos)
    conn.commit()
    conn.close()

# ----------------- View Routes -----------------
@app.route('/')
def index():
    return render_template('index.html')

# ----------------- API Routes -----------------
@app.route('/api/todos', methods=['GET'])
def get_todos():
    status = request.args.get('status', 'all')  # all, active, completed
    priority = request.args.get('priority', 'all')  # all, high, medium, low
    category = request.args.get('category', 'all')
    search = request.args.get('search', '').strip()

    query = 'SELECT * FROM todos WHERE 1=1'
    params = []

    if status == 'active':
        query += ' AND completed = 0'
    elif status == 'completed':
        query += ' AND completed = 1'

    if priority != 'all' and priority:
        query += ' AND priority = ?'
        params.append(priority)

    if category != 'all' and category:
        query += ' AND category = ?'
        params.append(category)

    if search:
        query += ' AND (title LIKE ? OR description LIKE ?)'
        search_pattern = f'%{search}%'
        params.extend([search_pattern, search_pattern])

    query += ' ORDER BY completed ASC, CASE priority WHEN "high" THEN 1 WHEN "medium" THEN 2 WHEN "low" THEN 3 ELSE 4 END, id DESC'

    conn = get_db_connection()
    todos = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(todo) for todo in todos])

@app.route('/api/todos', methods=['POST'])
def create_todo():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': '할 일 제목을 입력해주세요.'}), 400

    description = data.get('description', '').strip()
    priority = data.get('priority', 'medium')
    category = data.get('category', '일반')
    due_date = data.get('due_date', '')
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO todos (title, description, priority, category, due_date, completed, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    ''', (title, description, priority, category, due_date, created_at))
    new_id = cursor.lastrowid
    conn.commit()
    new_todo = conn.execute('SELECT * FROM todos WHERE id = ?', (new_id,)).fetchone()
    conn.close()

    return jsonify(dict(new_todo)), 201

@app.route('/api/todos/<int:todo_id>', methods=['GET'])
def get_todo(todo_id):
    conn = get_db_connection()
    todo = conn.execute('SELECT * FROM todos WHERE id = ?', (todo_id,)).fetchone()
    conn.close()
    if not todo:
        return jsonify({'error': '할 일을 찾을 수 없습니다.'}), 404
    return jsonify(dict(todo))

@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    data = request.get_json() or {}
    conn = get_db_connection()
    todo = conn.execute('SELECT * FROM todos WHERE id = ?', (todo_id,)).fetchone()
    if not todo:
        conn.close()
        return jsonify({'error': '할 일을 찾을 수 없습니다.'}), 404

    title = data.get('title', todo['title']).strip()
    description = data.get('description', todo['description'])
    priority = data.get('priority', todo['priority'])
    category = data.get('category', todo['category'])
    due_date = data.get('due_date', todo['due_date'])
    completed = 1 if data.get('completed', todo['completed']) else 0

    conn.execute('''
        UPDATE todos
        SET title = ?, description = ?, priority = ?, category = ?, due_date = ?, completed = ?
        WHERE id = ?
    ''', (title, description, priority, category, due_date, completed, todo_id))
    conn.commit()

    updated = conn.execute('SELECT * FROM todos WHERE id = ?', (todo_id,)).fetchone()
    conn.close()
    return jsonify(dict(updated))

@app.route('/api/todos/<int:todo_id>/toggle', methods=['PATCH'])
def toggle_todo(todo_id):
    conn = get_db_connection()
    todo = conn.execute('SELECT * FROM todos WHERE id = ?', (todo_id,)).fetchone()
    if not todo:
        conn.close()
        return jsonify({'error': '할 일을 찾을 수 없습니다.'}), 404

    new_status = 0 if todo['completed'] == 1 else 1
    conn.execute('UPDATE todos SET completed = ? WHERE id = ?', (new_status, todo_id))
    conn.commit()
    updated = conn.execute('SELECT * FROM todos WHERE id = ?', (todo_id,)).fetchone()
    conn.close()
    return jsonify(dict(updated))

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM todos WHERE id = ?', (todo_id,))
    conn.commit()
    changes = cursor.rowcount
    conn.close()

    if changes == 0:
        return jsonify({'error': '삭제할 항목이 없습니다.'}), 404
    return jsonify({'success': True, 'message': '성공적으로 삭제되었습니다.'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    total = conn.execute('SELECT COUNT(*) FROM todos').fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM todos WHERE completed = 1').fetchone()[0]
    active = total - completed
    rate = round((completed / total * 100), 1) if total > 0 else 0
    
    categories = [row[0] for row in conn.execute('SELECT DISTINCT category FROM todos WHERE category IS NOT NULL AND category != ""').fetchall()]
    conn.close()

    return jsonify({
        'total': total,
        'completed': completed,
        'active': active,
        'rate': rate,
        'categories': categories
    })

if __name__ == '__main__':
    init_db()
    print("Flask Todo Server starting on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
