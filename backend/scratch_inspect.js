const mongoose = require('mongoose');

async function inspect() {
  await mongoose.connect('mongodb://localhost:27017/nextlib_db');
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const lockers = await db.collection('lockers').find({ lockerNumber: '1' }).toArray();
  console.log('--- LOCKER 1 DOCUMENTS ---');
  console.log(JSON.stringify(lockers, null, 2));

  const lockersAll = await db.collection('lockers').find({}).toArray();
  console.log('\n--- ALL LOCKERS SUMMARY ---');
  lockersAll.forEach(l => {
    console.log(`Locker #${l.lockerNumber}: status=${l.status}, floor=${l.floor}, currentReservation=${JSON.stringify(l.currentReservation)}, assignedReservations=${JSON.stringify(l.assignedReservations)}`);
  });

  const studentsWithLocker = await db.collection('studentprofiles').find({ currentLockerId: { $ne: null } }).toArray();
  console.log('\n--- STUDENTS WITH LOCKERS ---');
  console.log(JSON.stringify(studentsWithLocker, null, 2));

  await mongoose.disconnect();
}

inspect().catch(console.error);
