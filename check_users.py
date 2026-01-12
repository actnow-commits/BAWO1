import psycopg2

dsn = "postgresql://postgres:Revelation$2033Jesus@db.tijsephkovqailbrwuzt.supabase.co:5432/postgres"

conn = psycopg2.connect(dsn)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT id, email FROM auth.users")
        users = cur.fetchall()
        print(f"Users found: {len(users)}")
        for user in users:
            print(f"User: {user[1]}")
finally:
    conn.close()
