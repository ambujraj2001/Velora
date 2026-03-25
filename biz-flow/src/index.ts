import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat';
import connectionRoutes from './routes/connections';
import conversationRoutes from './routes/conversations';
import dashboardRoutes from './routes/dashboard';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';

const app = express();
const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);
app.use(express.json());

// Main Routes
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/connections', connectionRoutes);
app.use('/conversations', conversationRoutes);
app.use('/dashboards', dashboardRoutes);
app.use('/settings', settingsRoutes);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
