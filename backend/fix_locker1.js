const mongoose = require('mongoose');

async function fixLocker() {
  await mongoose.connect('mongodb://localhost:27017/nextlib_db');
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const endAtDate = new Date('2026-09-29T00:00:00.000Z');

  const res = await db.collection('lockers').updateOne(
    { lockerNumber: '1', floor: 1 },
    {
      $set: {
        'currentReservation.endAt': endAtDate,
        'assignedReservations.0.endAt': endAtDate,
      },
    }
  );

  console.log('Locker 1 update result:', res);

  const updatedLocker = await db.collection('lockers').findOne({ lockerNumber: '1', floor: 1 });
  console.log('Updated Locker 1:', JSON.stringify(updatedLocker, null, 2));

  await mongoose.disconnect();
}

fixLocker().catch(console.error);
