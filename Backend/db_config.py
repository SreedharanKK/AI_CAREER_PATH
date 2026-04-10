import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME")
        )
        if conn.is_connected():
            return conn
    except Error as e:
        print("❌ Error connecting to MySQL:", e)
        return None
