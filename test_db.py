import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

try:
    # Connect to the database
    engine = create_engine(os.getenv("DATABASE_URL"))
    with engine.connect() as connection:
        # Run a quick query to count the users from your seed data
        result = connection.execute(text("SELECT count(*) FROM users;")).scalar()
        print(f"SUCCESS! Connected to Postgres. Found {result} users in the database.")
except Exception as e:
    print(f"ERROR: {e}")