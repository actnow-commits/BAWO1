import psycopg2
from urllib.parse import urlparse

# Connection string
dsn = "postgresql://postgres:Revelation$2033Jesus@db.tijsephkovqailbrwuzt.supabase.co:5432/postgres"

commands = [
    """
    CREATE TABLE IF NOT EXISTS site_content (
        key TEXT PRIMARY KEY,
        value TEXT,
        type TEXT
    )
    """,
    """
    ALTER TABLE site_content ENABLE ROW LEVEL SECURITY
    """,
    # Policies to allow read access to everyone, but write access only to authenticated users (or just open for now for simplicity of the script, but we should secure it. For this script, I'll allow anon read/write to test, or rely on service role. Actually, the DSN is the admin connection so it bypasses RLS).
    # But for the frontend client (anon key), we need policies.
    """
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT FROM pg_catalog.pg_policies 
            WHERE tablename = 'site_content' AND policyname = 'Enable read for anon users'
        ) THEN
            CREATE POLICY "Enable read for anon users" ON site_content FOR SELECT USING (true);
        END IF;
    END
    $$;
    """,
    """
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT FROM pg_catalog.pg_policies 
            WHERE tablename = 'site_content' AND policyname = 'Enable update for anon users'
        ) THEN
            -- WARNING: This allows anyone to update content. Ideally, we should restrict this to authenticated users.
            -- Since we don't have auth flow fully set up in this script, we'll allow it for now or assume the user will sign in.
            -- Better: Only allow if auth.role() = 'authenticated'
            CREATE POLICY "Enable update for authenticated users" ON site_content FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
            -- Also allow INSERT for authenticated
            CREATE POLICY "Enable insert for authenticated users" ON site_content FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        END IF;
    END
    $$;
    """
]
# Initial Content Data
initial_data = [
    ('home_hero_title', 'Inspiring Hope for Mothers & Newborns', 'text'),
    ('home_hero_text', 'Saving maternal and newborn healthcare through integrated clinical practice, education, and research in under-resourced communities.', 'text'),
    ('home_video_url', 'assets/hero-video.mp4', 'video'),
    ('mission_quote', '"To save maternal and newborn healthcare by inspiring hope and contributing to the improved health and well-being of pregnant women and their newborns through integrated clinical practice."', 'text'),
    ('about_origins_text', 'The BAWO Foundation traces its roots to Madam Bawo Wilson Omuso, the matriarch of the Omuso family and a direct descendant to Chief Kari of Nembe in Bayelsa State, South-South Nigeria.', 'text')
]

conn = psycopg2.connect(dsn)
try:
    with conn.cursor() as cur:
        # Create tables
        for command in commands:
            cur.execute(command)
        
        # Insert initial data if not exists
        for key, value, ctype in initial_data:
            cur.execute(
                "INSERT INTO site_content (key, value, type) VALUES (%s, %s, %s) ON CONFLICT (key) DO NOTHING",
                (key, value, ctype)
            )
            
    conn.commit()
    print("CMS Table created and initial content populated successfully.")
except Exception as e:
    print(f"An error occurred: {e}")
    conn.rollback()
finally:
    conn.close()
