const { getTagConfigs , connectDB, uploadTagConfigs } = require('./mongo');

async function main() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    await getTagConfigs();


  } catch (err) {
    console.error('An error occurred:', err);
  }
}

main();
