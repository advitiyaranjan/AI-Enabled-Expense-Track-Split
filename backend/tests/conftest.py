import os

# Must run before the app is imported: isolate tests from the dev database and any real OpenAI key
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["OPENAI_API_KEY"] = ""
