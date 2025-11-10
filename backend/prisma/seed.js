const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
  const pw = await bcrypt.hash('password', 10);
  const admin = await prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
  const tl = await prisma.role.upsert({ where: { name: 'team_lead' }, update: {}, create: { name: 'team_lead' } });
  const rep = await prisma.role.upsert({ where: { name: 'sales_rep' }, update: {}, create: { name: 'sales_rep' } });

  const teamA = await prisma.team.upsert({ where: { name: 'Sales Team A' }, update: {}, create: { name: 'Sales Team A' } });

  await prisma.user.upsert({ where: { email: 'john@company.com' }, update: {}, create: { name: 'John Doe', email: 'john@company.com', password: pw, roleId: admin.id, teamId: teamA.id, ipAddress: '192.168.1.100' } });
  await prisma.user.upsert({ where: { email: 'sarah@company.com' }, update: {}, create: { name: 'Sarah Wilson', email: 'sarah@company.com', password: pw, roleId: tl.id, teamId: teamA.id } });
  await prisma.user.upsert({ where: { email: 'mike@company.com' }, update: {}, create: { name: 'Mike Davis', email: 'mike@company.com', password: pw, roleId: rep.id, teamId: teamA.id } });

  await prisma.lead.createMany({ data: [
    { name: 'Acme Corporation', contactPerson: 'Jane Smith', email: 'jane@acme.com', status: 'new', assignedToId: 1, teamName: 'Sales Team A', dueDate: new Date('2024-11-05'), value: 50000, tags: ['enterprise','high-priority'] },
    { name: 'Tech Innovations Ltd', contactPerson: 'Bob Johnson', email: 'bob@techinno.com', status: 'contacted', assignedToId: 2, teamName: 'Sales Team A', dueDate: new Date('2024-11-04'), value: 30000, tags: ['demo-completed'] }
  ]});
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
