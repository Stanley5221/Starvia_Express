/**
 * Create an in-app notification for a user.
 */
async function createNotification(prisma, { userId, title, message, type, orderId }) {
  return prisma.notification.create({
    data: { userId, title, message, type, orderId: orderId || null },
  });
}

async function notifyAdmins(prisma, { title, message, type, orderId }) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      createNotification(prisma, { userId: a.id, title, message, type, orderId })
    )
  );
}

module.exports = { createNotification, notifyAdmins };
