# FOI Sentinel v2 — SPCS container image
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    streamlit==1.44.1 \
    snowflake-snowpark-python==1.24.0 \
    pandas==2.2.2 \
    plotly==5.24.1 \
    streamlit-sortables \
    wordcloud \
    matplotlib

# App code: entry + shared pages + theme config (forces GOV.UK light mode)
COPY spcs_main.py /app/spcs_main.py
COPY app_pages /app/app_pages
COPY .streamlit /app/.streamlit

EXPOSE 8080

# Streamlit served on 8080 for the SPCS endpoint
CMD ["streamlit", "run", "spcs_main.py", \
     "--server.port=8080", "--server.address=0.0.0.0", \
     "--server.headless=true", "--browser.gatherUsageStats=false"]
