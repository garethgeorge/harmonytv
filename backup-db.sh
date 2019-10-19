docker exec -it myplex_db_1 bash -c "pg_dump -U postgres -F t > /var/lib/postgresql/data/backup-$(date '+%Y-%m-%d').tar.gz"
