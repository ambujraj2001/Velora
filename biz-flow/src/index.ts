import express from 'express';
import cors from 'cors';
import { requestContextMiddleware } from './middleware/requestContext';
import chatRoutes from './routes/chat';
import connectionRoutes from './routes/connections';
import conversationRoutes from './routes/conversations';
import dashboardRoutes from './routes/dashboard';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import { log } from './lib/logger';

const app = express();
const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
    exposedHeaders: ['x-trace-id', 'x-request-id'],
  }),
);
app.use(express.json());
app.use(requestContextMiddleware);

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/connections', connectionRoutes);
app.use('/conversations', conversationRoutes);
app.use('/dashboards', dashboardRoutes);
app.use('/settings', settingsRoutes);

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  log('info', 'server_start', { port: Number(port) });
});
