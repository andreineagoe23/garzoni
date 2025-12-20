-- Update users to use caching_sha2_password on first initialization
ALTER USER 'monevo'@'%' IDENTIFIED WITH caching_sha2_password BY 'change-me';
FLUSH PRIVILEGES;

