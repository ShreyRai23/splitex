// =============================================================================
// prisma/seed.js
// Seeds the database with the five flatmates and the main group.
// Run with: node prisma/seed.js
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Default password for all seeded users — change after first login
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // Create the five flatmates in order of their appearance in the story.
  // joinedAt / leftAt are managed via GroupMembership, not on the User itself.
  const users = await Promise.all([
    prisma.user.upsert({
      where: { name: 'Aisha' },
      update: {},
      create: { name: 'Aisha', email: 'aisha@spiltex.local', passwordHash: defaultPasswordHash },
    }),
    prisma.user.upsert({
      where: { name: 'Rohan' },
      update: {},
      create: { name: 'Rohan', email: 'rohan@spiltex.local', passwordHash: defaultPasswordHash },
    }),
    prisma.user.upsert({
      where: { name: 'Priya' },
      update: {},
      create: { name: 'Priya', email: 'priya@spiltex.local', passwordHash: defaultPasswordHash },
    }),
    prisma.user.upsert({
      where: { name: 'Meera' },
      update: {},
      create: { name: 'Meera', email: 'meera@spiltex.local', passwordHash: defaultPasswordHash },
    }),
    prisma.user.upsert({
      where: { name: 'Sam' },
      update: {},
      create: { name: 'Sam', email: 'sam@spiltex.local', passwordHash: defaultPasswordHash },
    }),
    // Dev is a frequent guest (present in CSV) but not a core flatmate
    prisma.user.upsert({
      where: { name: 'Dev' },
      update: {},
      create: { name: 'Dev', email: 'dev@spiltex.local', passwordHash: defaultPasswordHash, isGuest: true },
    }),
    // Kabir — auto-created guest from Parasailing row (A8 anomaly resolution)
    prisma.user.upsert({
      where: { name: 'Kabir' },
      update: {},
      create: { name: 'Kabir', isGuest: true },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create the main flat group
  const group = await prisma.group.upsert({
    where: { name: 'Flat 4B' },
    update: {},
    create: { name: 'Flat 4B' },
  });

  console.log(`✅ Created group: ${group.name}`);

  // Get user refs
  const byName = Object.fromEntries(users.map((u) => [u.name, u]));

  // Create GroupMemberships with correct timelines.
  // These timelines are derived from the CSV story:
  //   - Aisha, Rohan, Priya, Meera: active from Feb 1
  //   - Meera left end of March
  //   - Sam joined mid-April (April 15 as per brief "mid-April")
  //   - Dev participates in specific expenses but is not a permanent resident
  const memberships = [
    { userId: byName['Aisha'].id, groupId: group.id, joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: byName['Rohan'].id, groupId: group.id, joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: byName['Priya'].id, groupId: group.id, joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: byName['Meera'].id, groupId: group.id, joinedAt: new Date('2026-02-01'), leftAt: new Date('2026-03-31') },
    { userId: byName['Sam'].id, groupId: group.id, joinedAt: new Date('2026-04-15'), leftAt: null },
  ];

  for (const m of memberships) {
    // Check if membership already exists before creating
    const existing = await prisma.groupMembership.findFirst({
      where: { userId: m.userId, groupId: m.groupId },
    });
    if (!existing) {
      await prisma.groupMembership.create({ data: m });
    }
  }

  console.log(`✅ Created ${memberships.length} group memberships`);
  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
