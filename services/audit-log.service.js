import { AuditLog } from '../models/index.js';

function normalized(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function adminDisplayName(admin) {
  return normalized(admin?.nickname || admin?.firstname || 'Administrateur', 100);
}

export function targetDisplayName(target) {
  return normalized(target?.nickname || target?.firstname || 'Membre', 255);
}

export async function recordAdminAction({
  admin,
  category,
  action,
  targetType,
  targetId = null,
  targetLabel,
  description,
  transaction,
}) {
  if (!admin?.id) throw new Error('AUDIT_ADMIN_REQUIRED');

  return AuditLog.create({
    adminId: admin.id,
    adminNickname: adminDisplayName(admin),
    category: normalized(category, 30),
    action: normalized(action, 60),
    targetType: normalized(targetType, 50),
    targetId: targetId === null || targetId === undefined
      ? null
      : normalized(targetId, 100),
    targetLabel: normalized(targetLabel, 255),
    description: normalized(description, 1000),
  }, { transaction });
}
