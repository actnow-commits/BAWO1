import psycopg2

dsn = "postgresql://postgres:Revelation$2033Jesus@db.tijsephkovqailbrwuzt.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    cur.execute("DELETE FROM site_content WHERE section_key = 'partner_opportunity';")
    conn.commit()
    print(f"Deleted {cur.rowcount} rows from site_content")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
