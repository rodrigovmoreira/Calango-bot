import { MongoMemoryServer } from 'mongodb-memory-server';

MongoMemoryServer.create().then(mms => {
  console.log(mms.getUri());
  setInterval(() => {}, 100000);
});
