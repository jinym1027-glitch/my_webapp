import os
import sqlite3
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kbo_schedule.db')

# KBO 10개 구단 정보 (팀명 -> 홈구장 / 상징 색상)
TEAMS = {
    '두산 베어스':   {'stadium': '잠실야구장',            'color': '#131230'},
    'LG 트윈스':     {'stadium': '잠실야구장',            'color': '#C30452'},
    'KT 위즈':       {'stadium': '수원KT위즈파크',        'color': '#000000'},
    'SSG 랜더스':    {'stadium': '인천SSG랜더스필드',      'color': '#CE0E2D'},
    'NC 다이노스':   {'stadium': '창원NC파크',            'color': '#315288'},
    '키움 히어로즈': {'stadium': '고척스카이돔',          'color': '#8C1D40'},
    '삼성 라이온즈': {'stadium': '대구삼성라이온즈파크',  'color': '#074CA1'},
    '롯데 자이언츠': {'stadium': '사직야구장',            'color': '#041E42'},
    '한화 이글스':   {'stadium': '대전한화생명이글스파크', 'color': '#FF6600'},
    'KIA 타이거즈':  {'stadium': '광주기아챔피언스필드',  'color': '#EA0029'},
}

STATUS_FLOW = ['예정', '진행중', '종료']


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_date TEXT NOT NULL,
            game_time TEXT DEFAULT '18:30',
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            stadium TEXT,
            status TEXT DEFAULT '예정',
            home_score INTEGER,
            away_score INTEGER,
            broadcast TEXT,
            memo TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    cursor.execute('SELECT COUNT(*) FROM games')
    count = cursor.fetchone()[0]
    if count == 0:
        today = datetime.now()
        now_str = today.strftime('%Y-%m-%d %H:%M:%S')

        def d(offset):
            return (today + timedelta(days=offset)).strftime('%Y-%m-%d')

        sample_games = [
            (d(-2), '18:30', '두산 베어스', 'LG 트윈스', '잠실야구장', '종료', 5, 3, 'SPOTV', '잠실 라이벌전', now_str),
            (d(-1), '18:30', 'KIA 타이거즈', '삼성 라이온즈', '광주기아챔피언스필드', '종료', 2, 7, 'KBS N SPORTS', '', now_str),
            (d(-1), '17:00', 'SSG 랜더스', '키움 히어로즈', '인천SSG랜더스필드', '종료', 4, 4, 'MBC SPORTS+', '연장 무승부', now_str),
            (d(0), '18:30', '롯데 자이언츠', '한화 이글스', '사직야구장', '진행중', 1, 2, 'SPOTV', '', now_str),
            (d(0), '18:30', 'NC 다이노스', 'KT 위즈', '창원NC파크', '예정', None, None, 'SPOTV2', '', now_str),
            (d(1), '18:30', 'LG 트윈스', 'KIA 타이거즈', '잠실야구장', '예정', None, None, 'SPOTV', '', now_str),
            (d(1), '14:00', '삼성 라이온즈', 'NC 다이노스', '대구삼성라이온즈파크', '예정', None, None, 'KBS N SPORTS', '주말 낮 경기', now_str),
            (d(2), '18:30', '두산 베어스', 'SSG 랜더스', '잠실야구장', '예정', None, None, 'MBC SPORTS+', '', now_str),
            (d(3), '18:30', '키움 히어로즈', 'KT 위즈', '고척스카이돔', '예정', None, None, 'SPOTV2', '', now_str),
            (d(-3), '18:30', '한화 이글스', '롯데 자이언츠', '대전한화생명이글스파크', '종료', 6, 1, 'SPOTV', '', now_str),
        ]
        cursor.executemany('''
            INSERT INTO games (game_date, game_time, home_team, away_team, stadium, status, home_score, away_score, broadcast, memo, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_games)
    conn.commit()
    conn.close()


# ----------------- View Routes -----------------
@app.route('/')
def index():
    return render_template('index.html', teams=TEAMS)


# ----------------- API Routes -----------------
@app.route('/api/teams', methods=['GET'])
def get_teams():
    return jsonify([{'name': name, **info} for name, info in TEAMS.items()])


@app.route('/api/games', methods=['GET'])
def get_games():
    status = request.args.get('status', 'all')  # all, 예정, 진행중, 종료
    team = request.args.get('team', 'all')       # all or team name (home or away)
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()
    search = request.args.get('search', '').strip()

    query = 'SELECT * FROM games WHERE 1=1'
    params = []

    if status != 'all' and status:
        query += ' AND status = ?'
        params.append(status)

    if team != 'all' and team:
        query += ' AND (home_team = ? OR away_team = ?)'
        params.extend([team, team])

    if date_from:
        query += ' AND game_date >= ?'
        params.append(date_from)

    if date_to:
        query += ' AND game_date <= ?'
        params.append(date_to)

    if search:
        query += ' AND (home_team LIKE ? OR away_team LIKE ? OR stadium LIKE ? OR memo LIKE ?)'
        pattern = f'%{search}%'
        params.extend([pattern, pattern, pattern, pattern])

    query += ' ORDER BY game_date ASC, game_time ASC, id ASC'

    conn = get_db_connection()
    games = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(g) for g in games])


@app.route('/api/games', methods=['POST'])
def create_game():
    data = request.get_json() or {}
    home_team = data.get('home_team', '').strip()
    away_team = data.get('away_team', '').strip()
    game_date = data.get('game_date', '').strip()

    if not home_team or not away_team:
        return jsonify({'error': '홈팀과 원정팀을 모두 선택해주세요.'}), 400
    if home_team == away_team:
        return jsonify({'error': '홈팀과 원정팀은 서로 달라야 합니다.'}), 400
    if not game_date:
        return jsonify({'error': '경기 날짜를 입력해주세요.'}), 400

    game_time = data.get('game_time', '18:30')
    stadium = data.get('stadium', '').strip() or TEAMS.get(home_team, {}).get('stadium', '')
    status = data.get('status', '예정')
    broadcast = data.get('broadcast', '').strip()
    memo = data.get('memo', '').strip()
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO games (game_date, game_time, home_team, away_team, stadium, status, home_score, away_score, broadcast, memo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    ''', (game_date, game_time, home_team, away_team, stadium, status, broadcast, memo, created_at))
    new_id = cursor.lastrowid
    conn.commit()
    new_game = conn.execute('SELECT * FROM games WHERE id = ?', (new_id,)).fetchone()
    conn.close()

    return jsonify(dict(new_game)), 201


@app.route('/api/games/<int:game_id>', methods=['GET'])
def get_game(game_id):
    conn = get_db_connection()
    game = conn.execute('SELECT * FROM games WHERE id = ?', (game_id,)).fetchone()
    conn.close()
    if not game:
        return jsonify({'error': '경기를 찾을 수 없습니다.'}), 404
    return jsonify(dict(game))


@app.route('/api/games/<int:game_id>', methods=['PUT'])
def update_game(game_id):
    data = request.get_json() or {}
    conn = get_db_connection()
    game = conn.execute('SELECT * FROM games WHERE id = ?', (game_id,)).fetchone()
    if not game:
        conn.close()
        return jsonify({'error': '경기를 찾을 수 없습니다.'}), 404

    home_team = data.get('home_team', game['home_team']).strip()
    away_team = data.get('away_team', game['away_team']).strip()
    game_date = data.get('game_date', game['game_date']).strip()
    game_time = data.get('game_time', game['game_time'])
    stadium = data.get('stadium', game['stadium'])
    status = data.get('status', game['status'])
    broadcast = data.get('broadcast', game['broadcast'])
    memo = data.get('memo', game['memo'])

    home_score = data.get('home_score', game['home_score'])
    away_score = data.get('away_score', game['away_score'])
    home_score = None if home_score in ('', None) else int(home_score)
    away_score = None if away_score in ('', None) else int(away_score)

    conn.execute('''
        UPDATE games
        SET home_team = ?, away_team = ?, game_date = ?, game_time = ?, stadium = ?,
            status = ?, home_score = ?, away_score = ?, broadcast = ?, memo = ?
        WHERE id = ?
    ''', (home_team, away_team, game_date, game_time, stadium, status, home_score, away_score, broadcast, memo, game_id))
    conn.commit()

    updated = conn.execute('SELECT * FROM games WHERE id = ?', (game_id,)).fetchone()
    conn.close()
    return jsonify(dict(updated))


@app.route('/api/games/<int:game_id>/status', methods=['PATCH'])
def cycle_status(game_id):
    conn = get_db_connection()
    game = conn.execute('SELECT * FROM games WHERE id = ?', (game_id,)).fetchone()
    if not game:
        conn.close()
        return jsonify({'error': '경기를 찾을 수 없습니다.'}), 404

    data = request.get_json(silent=True) or {}
    if 'status' in data and data['status'] in STATUS_FLOW:
        new_status = data['status']
    else:
        current_idx = STATUS_FLOW.index(game['status']) if game['status'] in STATUS_FLOW else 0
        new_status = STATUS_FLOW[(current_idx + 1) % len(STATUS_FLOW)]

    conn.execute('UPDATE games SET status = ? WHERE id = ?', (new_status, game_id))
    conn.commit()
    updated = conn.execute('SELECT * FROM games WHERE id = ?', (game_id,)).fetchone()
    conn.close()
    return jsonify(dict(updated))


@app.route('/api/games/<int:game_id>', methods=['DELETE'])
def delete_game(game_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM games WHERE id = ?', (game_id,))
    conn.commit()
    changes = cursor.rowcount
    conn.close()

    if changes == 0:
        return jsonify({'error': '삭제할 경기가 없습니다.'}), 404
    return jsonify({'success': True, 'message': '경기 일정이 삭제되었습니다.'})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    total = conn.execute('SELECT COUNT(*) FROM games').fetchone()[0]
    scheduled = conn.execute("SELECT COUNT(*) FROM games WHERE status = '예정'").fetchone()[0]
    live = conn.execute("SELECT COUNT(*) FROM games WHERE status = '진행중'").fetchone()[0]
    finished = conn.execute("SELECT COUNT(*) FROM games WHERE status = '종료'").fetchone()[0]

    today = datetime.now().strftime('%Y-%m-%d')
    today_count = conn.execute('SELECT COUNT(*) FROM games WHERE game_date = ?', (today,)).fetchone()[0]
    conn.close()

    return jsonify({
        'total': total,
        'scheduled': scheduled,
        'live': live,
        'finished': finished,
        'today': today_count,
    })


init_db()

if __name__ == '__main__':
    print("KBO Schedule Flask Server starting on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
