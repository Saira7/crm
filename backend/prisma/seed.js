const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function createUser(name, email, password, roleId, teamId = null) {
  return prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      roleId,
      teamId,
    },
  });
}

async function main() {
  console.log("Starting Seeding...");

  // -----------------------------
  // ROLES
  // -----------------------------
  const managerRole = await prisma.role.upsert({
    where: { name: "Manager" },
    update: {},
    create: { name: "Manager", description: "Management role" },
  });

  const teamLeadRole = await prisma.role.upsert({
    where: { name: "Team Lead" },
    update: {},
    create: { name: "Team Lead", description: "Leads a team" },
  });

  const agentRole = await prisma.role.upsert({
    where: { name: "Agent" },
    update: {},
    create: { name: "Agent", description: "Regular team member" },
  });

  // -----------------------------
  // TEAMS
  // -----------------------------
  const teams = {
    A: await prisma.team.upsert({
      where: { name: "Team A" },
      update: {},
      create: { name: "Team A", description: "Team A CRM Agents" },
    }),
    B: await prisma.team.upsert({
      where: { name: "Team B" },
      update: {},
      create: { name: "Team B", description: "Team B CRM Agents" },
    }),
    C: await prisma.team.upsert({
      where: { name: "Team C" },
      update: {},
      create: { name: "Team C", description: "Team C CRM Agents" },
    }),
    D: await prisma.team.upsert({
      where: { name: "Team D" },
      update: {},
      create: { name: "Team D", description: "Team D CRM Agents" },
    }),
    Kohinoor: await prisma.team.upsert({
      where: { name: "Team Kohinoor" },
      update: {},
      create: { name: "Team Kohinoor", description: "Special team" },
    }),
  };

  
  await createUser("Sharoon", "sharoon@example.com", "Password123!", agentRole.id,teamKohinoor.id);
  await createUser("Shahwaiz", "shahwaiz@example.com", "Password123!", agentRole.id,teamKohinoor.id);

  // -----------------------------
  // TEAM C
  // -----------------------------
  const teamC_leads = ["Akasha Naz", "Mehreen Munir"];
  for (const lead of teamC_leads) {
    await createUser(lead, `${lead.toLowerCase().replace(/ /g, "")}@example.com`,
      "Password123!", teamLeadRole.id, teams.C.id);
  }

  const teamC_members = [
    "Abdul Rehman", "Hamza Khalid", "Musab Umair", "Haseeb Shahid", "Zain ul Abidin",
    "Muhammad Faisal", "Muhammad Waleed", "Sayeda Amna", "Neha Khan",
    "Nabeera Imran", "Mahnoor", "Ayesha Noor"
  ];

  for (const member of teamC_members) {
    await createUser(
      member,
      `${member.toLowerCase().replace(/ /g, "")}@example.com`,
      "Password123!",
      agentRole.id,
      teams.C.id
    );
  }

  // -----------------------------
  // TEAM A
  // -----------------------------
  const teamA_leads = ["Eman", "Asima"];
  for (const lead of teamA_leads) {
    await createUser(lead, `${lead.toLowerCase()}@example.com`,
      "Password123!", teamLeadRole.id, teams.A.id);
  }

  const teamA_members = [
    "Rubab Sehar", "Shazeena Mariam", "Farah Zanib", "Ali Afzal", "Rehan Shahzad",
    "Turab Haider", "Waqas Akram", "Abdur Rehman", "Uswa Adnan"
  ];

  for (const member of teamA_members) {
    await createUser(
      member,
      `${member.toLowerCase().replace(/ /g, "")}@example.com`,
      "Password123!",
      agentRole.id,
      teams.A.id
    );
  }

  // -----------------------------
  // TEAM D
  // -----------------------------
  await createUser(
    "Mishal Fatima",
    "mishal@example.com",
    "Password123!",
    teamLeadRole.id,
    teams.D.id
  );

  const teamD_members = [
    "Nouman Ahmed", "Maheen Abbas", "Faizan Ali", "Abdullah Zahid",
    "Mukaram Masoom", "Wazooha Imran", "Sonia Shah", "Ammar Bin Yasir", "Abdullah Nawaz"
  ];

  for (const member of teamD_members) {
    await createUser(
      member,
      `${member.toLowerCase().replace(/ /g, "")}@example.com`,
      "Password123!",
      agentRole.id,
      teams.D.id
    );
  }

  // -----------------------------
  // TEAM B
  // -----------------------------
  await createUser("Saira", "saira@example.com", "Password123!", teamLeadRole.id, teams.B.id);

  const teamB_members = [
    "Noor ul Huda", "Khizra", "Javeria Latif", "Muhammad Ahmed", "Ali Hamza",
    "Muhammad Ubaid Ullah", "Muhammad Umair", "Umar Raza", "Muhammad Junaid",
    "Areeba Shahzadi", "Muhammad Qamar ul Islam"
  ];

  for (const member of teamB_members) {
    await createUser(
      member,
      `${member.toLowerCase().replace(/ /g, "")}@example.com`,
      "Password123!",
      agentRole.id,
      teams.B.id
    );
  }

  // -----------------------------
  // TEAM KOHINOOR
  // -----------------------------
  await createUser("Hadi", "hadi@example.com", "Password123!", teamLeadRole.id, teams.Kohinoor.id);

  console.log("✅ Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
