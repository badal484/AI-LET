variable "environment" {
  description = "Deployment environment (development, staging, production)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "Target AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name prefix"
  type        = string
  default     = "ai-companion"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones for multi-AZ deployment"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "database_instance_class" {
  description = "RDS PostgreSQL instance type"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "database_allocated_storage" {
  description = "Allocated storage in GB for RDS PostgreSQL"
  type        = number
  default     = 100
}

variable "database_max_allocated_storage" {
  description = "Autoscaling max storage in GB for RDS PostgreSQL"
  type        = number
  default     = 1000
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters for Redis replication group"
  type        = number
  default     = 3
}

variable "api_task_cpu" {
  description = "Fargate CPU units for API containers (1024 = 1 vCPU)"
  type        = number
  default     = 2048
}

variable "api_task_memory" {
  description = "Fargate Memory (MB) for API containers"
  type        = number
  default     = 4096
}

variable "api_min_instances" {
  description = "Minimum API task instances for autoscaling"
  type        = number
  default     = 4
}

variable "api_max_instances" {
  description = "Maximum API task instances for autoscaling"
  type        = number
  default     = 40
}

variable "worker_min_instances" {
  description = "Minimum queue worker task instances"
  type        = number
  default     = 2
}

variable "worker_max_instances" {
  description = "Maximum queue worker task instances"
  type        = number
  default     = 20
}

variable "domain_name" {
  description = "Primary domain name for the platform"
  type        = string
  default     = "aicompanion.app"
}
