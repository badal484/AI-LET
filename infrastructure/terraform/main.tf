terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ai-companion-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ai-companion-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.app_name
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# 1. NETWORK TOPOLOGY (VPC, Subnets, NAT, Routing)
# -----------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.app_name}-${var.environment}-vpc"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.app_name}-${var.environment}-public-subnet-${count.index + 1}"
    Type = "Public"
  }
}

resource "aws_subnet" "private_app" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.app_name}-${var.environment}-private-app-${count.index + 1}"
    Type = "PrivateApp"
  }
}

resource "aws_subnet" "private_data" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 8)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.app_name}-${var.environment}-private-data-${count.index + 1}"
    Type = "PrivateData"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.app_name}-${var.environment}-igw"
  }
}

resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"

  tags = {
    Name = "${var.app_name}-${var.environment}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "nat" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.app_name}-${var.environment}-nat-gw-${count.index + 1}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat[count.index].id
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-private-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private_app" {
  count          = length(aws_subnet.private_app)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private[count.index % 2].id
}

# -----------------------------------------------------------------------------
# 2. SECURITY GROUPS
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.app_name}-${var.environment}-alb-sg"
  description = "Security group for external Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTP for redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.app_name}-${var.environment}-ecs-sg"
  description = "Security group for ECS Fargate API and Worker containers"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow traffic from ALB"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.app_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL Database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow PostgreSQL access from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis" {
  name        = "${var.app_name}-${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow Redis access from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# -----------------------------------------------------------------------------
# 3. MANAGED PERSISTENCE (RDS PostgreSQL + ElastiCache Redis)
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "rds" {
  name       = "${var.app_name}-${var.environment}-rds-subnet-group"
  subnet_ids = aws_subnet.private_data[*].id

  tags = {
    Name = "${var.app_name}-${var.environment}-rds-subnet-group"
  }
}

resource "aws_db_parameter_group" "pgvector" {
  name   = "${var.app_name}-${var.environment}-pg16-pgvector"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "pgvector,pg_stat_statements"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "500" # Log slow queries > 500ms
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "${var.app_name}-${var.environment}-postgres"
  engine                      = "postgres"
  engine_version              = "16.3"
  instance_class              = var.database_instance_class
  allocated_storage           = var.database_allocated_storage
  max_allocated_storage       = var.database_max_allocated_storage
  storage_type                = "gp3"
  storage_encrypted           = true
  multi_az                    = var.environment == "production" ? true : false
  db_subnet_group_name        = aws_db_subnet_group.rds.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  parameter_group_name        = aws_db_parameter_group.pgvector.name
  db_name                     = "ai_companion_${var.environment}"
  username                    = "app_admin"
  manage_master_user_password = true

  backup_retention_period   = var.environment == "production" ? 30 : 7
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:30-Mon:05:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = "${var.app_name}-${var.environment}-final-snapshot"

  performance_insights_enabled    = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.app_name}-${var.environment}-redis-subnet-group"
  subnet_ids = aws_subnet.private_data[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.app_name}-${var.environment}-redis"
  description                   = "Production Redis Replication Group for BullMQ, Sessions, and Caches"
  engine                        = "redis"
  engine_version                = "7.1"
  node_type                     = var.redis_node_type
  num_cache_clusters            = var.redis_num_cache_clusters
  parameter_group_name          = "default.redis7"
  port                          = 6379
  subnet_group_name             = aws_elasticache_subnet_group.redis.name
  security_group_ids            = [aws_security_group.redis.id]
  automatic_failover_enabled    = true
  multi_az_enabled              = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  auth_token_update_strategy    = "SET"
  snapshot_retention_limit      = 7
  snapshot_window               = "02:00-03:00"
  maintenance_window            = "sun:05:00-sun:06:00"
  apply_immediately             = false
}

# -----------------------------------------------------------------------------
# 4. S3 OBJECT STORAGE & CLOUDFRONT CDN
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "media" {
  bucket = "${var.app_name}-${var.environment}-media-vault"
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "expire_temp_uploads_and_cleanup"
    status = "Enabled"

    filter {
      prefix = "tmp/"
    }

    expiration {
      days = 3
    }
  }

  rule {
    id     = "transition_archive"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# -----------------------------------------------------------------------------
# 5. ECS FARGATE CLUSTERING, API & WORKER SERVICES
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
