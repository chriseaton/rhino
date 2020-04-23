FROM microsoft/mssql-server-linux:latest
COPY ./install.sql .
COPY ./install.sh .
COPY ./startup.sh .
RUN chmod +x ./install.sh ./startup.sh
ENV ACCEPT_EULA Y
ENV MSSQL_PID Express
ARG SA_PASSWORD
ENV SA_PASSWORD=${SA_PASSWORD}
EXPOSE 1433
CMD /bin/bash ./startup.sh