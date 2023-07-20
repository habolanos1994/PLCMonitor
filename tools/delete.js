const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function clearOeeCollection() {
  try {
    await client.connect();
    const database = client.db('ELP');
    const collection = database.collection('OEE');
    const result = await collection.deleteMany({});
    console.log(`${result.deletedCount} documents deleted from the collection.`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

clearOeeCollection();
