# Database Restore Guide

This guide explains how to restore the MySQL database from a backup SQL file.

## Available Backups

Backup files are stored in the `backend/backups/` directory. The latest backup file is typically:

- `backend/backups/database_backup_20251222_181025.sql` (Latest - Dec 22, 2025 18:10:25)

To see all available backups:

```bash
ls -lh backend/backups/database_backup_*.sql
```

## Quick Restore (Using Script)

### Windows (PowerShell)

```powershell
# Restore from latest backup
.\backend\backups\restore_database.ps1

# Restore from specific backup
.\backend\backups\restore_database.ps1 -BackupFile "backend\backups\database_backup_20251222_181025.sql"
```

### Linux/Mac (Bash)

```bash
# Make script executable
chmod +x restore_database.sh

# Restore from latest backup
./backend/backups/restore_database.sh

# Restore from specific backup
./backend/backups/restore_database.sh backend/backups/database_backup_20251222_181025.sql
```

## Manual Restore

### Step 1: Ensure Docker is Running

```bash
# Check if database container is running
docker compose ps

# If not running, start the database
docker compose up -d db
```

### Step 2: Wait for Database to be Ready

```bash
# Check database health
docker compose exec db mysqladmin ping -h localhost -uroot -precover123
```

### Step 3: Drop and Recreate Database

```bash
# Drop existing database
docker compose exec db mysql -uroot -precover123 -e "DROP DATABASE IF EXISTS monevo;"

# Create new database
docker compose exec db mysql -uroot -precover123 -e "CREATE DATABASE monevo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 4: Restore from Backup

**Option A: Using Docker exec with input redirection (Recommended)**

```bash
# Restore from backup file
docker compose exec -T db mysql -uroot -precover123 monevo < backend/backups/database_backup_20251222_181025.sql
```

**Option B: Copy file to container and restore**

```bash
# Copy backup file to container
docker cp backend/database_backup_20251222_181025.sql $(docker compose ps -q db):/tmp/backup.sql

# Restore from backup
docker compose exec db bash -c "mysql -uroot -precover123 monevo < /tmp/backup.sql"

# Clean up
docker compose exec db rm /tmp/backup.sql
```

**Option C: Using Docker exec with source command**

```bash
# Copy backup file to container
docker cp backend/database_backup_20251222_181025.sql $(docker compose ps -q db):/tmp/backup.sql

# Restore using source command
docker compose exec db mysql -uroot -precover123 monevo -e "source /tmp/backup.sql"

# Clean up
docker compose exec db rm /tmp/backup.sql
```

### Step 5: Run Migrations

After restoring, run migrations to ensure the schema is up to date:

```bash
# Run migrations
docker compose exec backend python manage.py migrate

# If you encounter migration errors, you may need to fake migrations
docker compose exec backend python manage.py migrate --fake-initial
```

## Database Configuration

Default values (can be overridden with environment variables):

- **Database Name**: `monevo`
- **Root Password**: `recover123`
- **User**: `monevo`
- **Password**: `monevo`
- **Port**: `3307` (host) / `3306` (container)

## Troubleshooting

### Error: "Unknown database 'monevo'"

The database doesn't exist. Create it first:

```bash
docker compose exec db mysql -uroot -precover123 -e "CREATE DATABASE monevo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Error: "Access denied for user"

Check your database credentials. You can verify them in `docker-compose.yml` or set environment variables:

```bash
export MYSQL_ROOT_PASSWORD=recover123
export MYSQL_DATABASE=monevo
export MYSQL_USER=monevo
export MYSQL_PASSWORD=monevo
```

### Error: "Container is not running"

Start the database container:

```bash
docker compose up -d db
```

Wait for it to be ready:

```bash
docker compose exec db mysqladmin ping -h localhost -uroot -precover123
```

### Migration Errors After Restore

If you encounter migration errors after restoring:

1. Check which migrations are already applied:

   ```bash
   docker compose exec backend python manage.py showmigrations
   ```

2. If migrations are out of sync, you may need to fake them:

   ```bash
   docker compose exec backend python manage.py migrate --fake-initial
   ```

3. Or mark specific migrations as applied:
   ```bash
   docker compose exec backend python manage.py migrate --fake authentication 0002_userprofile_is_premium_and_more
   ```

### Large Backup Files

For large backup files, the restore process may take several minutes. You can monitor progress:

```bash
# In another terminal, monitor the container logs
docker compose logs -f db
```

## Creating Backups

To create a new backup:

```bash
# Backup database
docker compose exec db mysqldump -uroot -precover123 monevo > backend/backups/database_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression (recommended for large databases)
docker compose exec db mysqldump -uroot -precover123 monevo | gzip > backend/backups/database_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

## Important Notes

⚠️ **WARNING**: Restoring a database will **DELETE all existing data** in the database and replace it with the backup data.

- Always backup your current database before restoring
- Verify the backup file is correct before restoring
- Test the restore process in a development environment first
- The restore process is **irreversible** - make sure you have a backup of current data if needed
