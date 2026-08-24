import fs from 'node:fs/promises';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import {
  AuditLog,
  Player,
  Role,
  sequelize,
} from '../models/index.js';

function argumentsMap(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('Arguments invalides. Consultez npm run admin:create -- --help.');
    }
    result[key.slice(2)] = value;
  }
  return result;
}

function usage() {
  console.log(`Création sécurisée du premier administrateur

Options obligatoires :
  --firstname <prénom>
  --lastname <nom>
  --nickname <pseudo>
  --email <adresse>
  --password-file <chemin privé>

Option de vérification :
  --dry-run true     Valide toute l'opération puis annule la transaction.`);
}

function normalized(value) {
  return String(value || '').trim();
}

const rawArguments = process.argv.slice(2);
if (rawArguments.includes('--help')) {
  usage();
  process.exit(0);
}

let exitCode = 0;
try {
  const options = argumentsMap(rawArguments);
  const firstname = normalized(options.firstname);
  const lastname = normalized(options.lastname);
  const nickname = normalized(options.nickname);
  const email = normalized(options.email).toLowerCase();
  const passwordFile = normalized(options['password-file']);
  const dryRun = options['dry-run'] === 'true';

  if (!firstname || firstname.length > 100
    || !lastname || lastname.length > 100
    || !nickname || nickname.length > 50
    || !email || email.length > 255
    || !passwordFile) {
    throw new Error('Les informations obligatoires sont absentes ou trop longues.');
  }

  const password = (await fs.readFile(passwordFile, 'utf8')).replace(/[\r\n]+$/, '');
  if (password.length < 12 || password.length > 128
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password)
    || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Le mot de passe doit contenir 12 à 128 caractères, avec minuscule, majuscule, chiffre et symbole.');
  }

  await sequelize.transaction(async (transaction) => {
    const adminRole = await Role.findOne({
      where: { name: 'Admin' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!adminRole) throw new Error('Le rôle Admin est absent. Exécutez les migrations.');

    const adminCount = await Player.count({ where: { roleId: adminRole.id }, transaction });
    if (adminCount > 0) throw new Error('Un administrateur existe déjà. Création initiale refusée.');

    const duplicate = await Player.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: email } },
          { nickname: { [Op.iLike]: nickname } },
        ],
      },
      transaction,
    });
    if (duplicate) throw new Error('Cette adresse e-mail ou ce pseudonyme est déjà utilisé.');

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Player.create({
      firstname,
      lastname,
      nickname,
      email,
      password: passwordHash,
      roleId: adminRole.id,
      isActive: true,
      moderationStatus: 'active',
      acceptedTermsAt: new Date(),
      acceptedTermsVersion: '2026-07',
    }, { transaction });

    await AuditLog.create({
      adminId: admin.id,
      adminNickname: nickname,
      category: 'members',
      action: 'initial_admin_created',
      targetType: 'player',
      targetId: String(admin.id),
      targetLabel: nickname,
      description: 'Premier compte administrateur créé par la procédure sécurisée d’amorçage.',
    }, { transaction });

    if (dryRun) throw new Error('ADMIN_DRY_RUN_COMPLETE');
  });

  console.log('Premier administrateur créé avec succès. Supprimez immédiatement le fichier de mot de passe.');
} catch (error) {
  if (error.message === 'ADMIN_DRY_RUN_COMPLETE') {
    console.log('Vérification réussie : la transaction de test a été annulée, aucun compte n’a été conservé.');
  } else {
    console.error(`Création du premier administrateur impossible : ${error.message}`);
    exitCode = 1;
  }
} finally {
  await sequelize.close().catch(() => {});
}

process.exitCode = exitCode;
