import mysql.connector
from mysql.connector import Error

def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host="localhost",       # change if needed
            user="root",            # your MySQL username
            password="Sree2004$",# your MySQL password
            database="project_ai"   # database name
        )
        return conn
    except Error as e:
        print("❌ Error connecting to MySQL:", e)
        return None
