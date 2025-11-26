// backend/scripts/syncLeadTeamsFromUsers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting lead team sync...');

  // Get all users with their teams
  const users = await prisma.user.findMany({
    include: { team: true },
  });

  for (const u of users) {
    const teamId = u.teamId || null;
    const teamName = u.team?.name || null;

    // If user has no team, skip or clear – here we skip
    if (!teamId && !teamName) {
      console.log(
        `User ${u.id} (${u.name || u.email}) has no team, skipping...`
      );
      continue;
    }

    const result = await prisma.lead.updateMany({
      where: { assignedToId: u.id },
      data: {
        teamId,
        teamName,
      },
    });

    console.log(
      `User ${u.id} (${u.name || u.email}) -> teamId=${teamId}, teamName=${teamName}, updated leads=${result.count}`
    );
  }

  console.log('Finished syncing lead teams.');
}

main()
  .catch((e) => {
    console.error('Error in syncLeadTeamsFromUsers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
