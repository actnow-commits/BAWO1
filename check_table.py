import psycopg2
dsn = "postgresql://postgres:Revelation$2033Jesus@db.tijsephkovqailbrwuzt.supabase.co:5432/postgres"
conn = psycopg2.connect(dsn)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_submissions'")
        columns = cur.fetchall()
        print(f"Columns in user_submissions: {[c[0] for c in columns]}")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
