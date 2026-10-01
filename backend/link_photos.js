const mongoose = require('mongoose');

async function linkPhotos() {
  await mongoose.connect('mongodb://localhost:27017/nextlib_db');
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  await db.collection('studentprofiles').updateOne(
    { _id: new mongoose.Types.ObjectId('6ab87ff0d45cc285a5a3ee99') },
    { $set: { profilePicture: 'profile-1790476272500-655352547.webp' } }
  );

  await db.collection('studentprofiles').updateOne(
    { _id: new mongoose.Types.ObjectId('6ab8804dd45cc285a5a3ef2c') },
    { $set: { profilePicture: 'profile-1790476365309-132237424.webp' } }
  );

  console.log('Successfully linked profile pictures for 27 sept one and 27 sept two!');
  await mongoose.disconnect();
}

linkPhotos().catch(console.error);
