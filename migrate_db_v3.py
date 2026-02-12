import psycopg2

# Connection string
dsn = "postgresql://postgres:Revelation$2033Jesus@db.tijsephkovqailbrwuzt.supabase.co:5432/postgres"

commands = [
    # Rename 'key' to 'section_key' in site_content
    """
    ALTER TABLE site_content RENAME COLUMN key TO section_key;
    """
]

conn = psycopg2.connect(dsn)
try:
    with conn.cursor() as cur:
        for command in commands:
            cur.execute(command)
    conn.commit()
    print("Column 'key' renamed to 'section_key' successfully.")
except Exception as e:
    print(f"An error occurred: {e}")
    conn.rollback()
finally:
    conn.close()
