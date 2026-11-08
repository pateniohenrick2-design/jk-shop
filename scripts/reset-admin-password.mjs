// Reset an admin's password (and optionally username) when it's forgotten.
// Runs on your own computer using the database login in .env — website visitors can't use this.
//
// Usage (from the project folder):
//   node --env-file=.env scripts/reset-admin-password.mjs
//     → lists admin accounts, then asks which one and the new password (typing is hidden)
//   node --env-file=.env scripts/reset-admin-password.mjs <username>
//     → resets that account directly

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

const prisma = new PrismaClient();

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question, then mask what's typed
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const admins = await prisma.admin.findMany({ select: { id: true, username: true, role: true }, orderBy: { createdAt: 'asc' } });
  if (admins.length === 0) {
    console.log('No admin accounts exist. Run the seed (npx prisma db seed) or create one first.');
    return;
  }

  let username = process.argv[2];
  if (!username) {
    console.log('Admin accounts:');
    admins.forEach((a) => console.log(`  • ${a.username}  (${a.role === 'super_admin' ? 'Super Admin' : 'Staff'})`));
    username = admins.length === 1 ? admins[0].username : await ask('Which username do you want to reset? ');
  }

  const admin = admins.find((a) => a.username === username);
  if (!admin) {
    console.log(`No admin named "${username}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`Resetting password for "${admin.username}".`);

  const password = await ask('New password (min 8 characters): ', { hidden: true });
  if (password.length < 8) {
    console.log('Password must be at least 8 characters. Nothing was changed.');
    process.exitCode = 1;
    return;
  }
  const confirm = await ask('Type it again: ', { hidden: true });
  if (password !== confirm) {
    console.log('Passwords do not match. Nothing was changed.');
    process.exitCode = 1;
    return;
  }

  const newUsername = await ask(`New username (press Enter to keep "${admin.username}"): `);
  const data = { passwordHash: await bcrypt.hash(password, 10) };
  if (newUsername && newUsername !== admin.username) {
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(newUsername)) {
      console.log('Username must be 3–32 characters: letters, numbers, dot, dash or underscore. Nothing was changed.');
      process.exitCode = 1;
      return;
    }
    if (admins.some((a) => a.username === newUsername)) {
      console.log('That username is already taken. Nothing was changed.');
      process.exitCode = 1;
      return;
    }
    data.username = newUsername;
  }

  await prisma.admin.update({ where: { id: admin.id }, data });
  console.log(`✔ Done. Sign in as "${data.username ?? admin.username}" with your new password.`);
}

main()
  .catch((err) => { console.error('Reset failed:', err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
