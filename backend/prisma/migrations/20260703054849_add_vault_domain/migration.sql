-- CreateEnum
CREATE TYPE "VaultType" AS ENUM ('DEPARTMENT', 'PROJECT', 'CLIENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VaultStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FolderStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FolderPermissionType" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "vault_id" TEXT;

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '/',
ADD COLUMN     "status" "FolderStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "vault_id" TEXT;

-- CreateTable
CREATE TABLE "vaults" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "VaultType" NOT NULL DEFAULT 'CUSTOM',
    "status" "VaultStatus" NOT NULL DEFAULT 'ACTIVE',
    "owner_id" TEXT NOT NULL,
    "department_id" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_permissions" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" "FolderPermissionType" NOT NULL DEFAULT 'READ',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaults_name_key" ON "vaults"("name");

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE SET NULL ON UPDATE CASCADE;
