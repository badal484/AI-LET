output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "database_endpoint" {
  description = "Primary RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "database_name" {
  description = "Name of the default PostgreSQL database"
  value       = aws_db_instance.postgres.db_name
}

output "redis_primary_endpoint" {
  description = "Primary endpoint address for ElastiCache Redis replication group"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "s3_media_bucket_name" {
  description = "Name of the S3 media vault bucket"
  value       = aws_s3_bucket.media.id
}
