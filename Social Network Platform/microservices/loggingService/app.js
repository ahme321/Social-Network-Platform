const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./logger');
const redis = require('redis');
const { Kafka } = require('kafkajs');

const app = express();
const port = 3000;

const redisClient = redis.createClient();
redisClient.connect().catch(console.error);

const kafka = new Kafka({
  clientId: 'logging-service',
  brokers: ['kafka:9093']
});

const producer = kafka.producer();
const initKafka = async () => {
  await producer.connect();
};
initKafka();

app.use(bodyParser.json());

app.get('/logs', async (req, res) => {
  try {
    const data = await redisClient.get('logs');
    res.json(JSON.parse(data) || []);
  } catch (err) {
    logger.error('Failed to get logs');
    res.status(500).send('Error');
  }
});

app.post('/logs', async (req, res) => {
  const log = req.body;
  logger.info(`New log: ${JSON.stringify(log)}`);

  await producer.send({
    topic: 'logs',
    messages: [{ value: JSON.stringify(log) }]
  });

  await redisClient.set('logs', JSON.stringify([log]));
  res.status(201).send('Log stored');
});

app.listen(port, () => {
  logger.info(`Logging service running on port ${port}`);
});