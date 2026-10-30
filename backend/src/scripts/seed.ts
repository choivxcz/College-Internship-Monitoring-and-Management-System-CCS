import { db, runTransaction, User, Student, Application } from '../db.js';
import { hashPassword } from '../security.js';
import { password } from '../validation.js';
import { z } from 'zod';
try {
  const email = z.string().email().parse(process.env.ADMIN_EMAIL || 'admin@lspu.edu.ph').toLowerCase();
  if (!await User.findOne({ where: { email } })) {
    const adminPassword = password.parse(process.env.ADMIN_PASSWORD);
    await User.create({ email, name: process.env.ADMIN_NAME || 'Internship Coordinator', role: 'admin', passwordHash: await hashPassword(adminPassword) });
    console.log(`Administrator created: ${email}`);
  } else console.log('Administrator already exists; password unchanged.');
  if (process.env.SEED_DEMO === 'true') {
    const demoPassword = password.parse(process.env.DEMO_STUDENT_PASSWORD);
    const id = 'DEMO-0001';
    await runTransaction(async transaction => {
      if (await Student.findByPk(id, { transaction })) return;
      await Student.create({ id, name: 'Demo Student', email: 'student@example.edu', program: 'BSIT', section: '4A', requiredHours: 480,
        degree: 'BS Information Technology (BSIT)', yearSection: '4th year · BSIT 4A', term: '1st semester, AY 2026–2027', course: 'IT 401 · Internship / Practicum', adviser: 'Demo Adviser' }, { transaction });
      await User.create({ email: 'student@example.edu', name: 'Demo Student', role: 'student', studentId: id, passwordHash: await hashPassword(demoPassword) }, { transaction });
      await Application.create({ studentId: id, organization: 'Example Organization', position: 'Software Development Intern', status: 'Interning', appliedOn: '2026-10-01', notes: 'Fictional demonstration record.' }, { transaction });
    });
    console.log('Optional demo student is ready: DEMO-0001 / student@example.edu');
  }
} catch (error) { console.error('Seeding failed. Set ADMIN_PASSWORD (and DEMO_STUDENT_PASSWORD if enabled) to at least 10 characters.', error); process.exitCode = 1; }
finally { await db.close(); }
