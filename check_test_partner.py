import psycopg2

dsn = "postgresql://postgres:Revelation$2033Jesus@db.tijsephkovqailbrwuzt.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    cur.execute("SELECT section_key, title FROM site_content WHERE section_key LIKE 'partner_%';")
    rows = cur.fetchall()
    print("Partner rows:")
    for r in rows:
        print(r)
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
