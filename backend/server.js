require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const roleRoutes = require('./routes/roles');
const leadRoutes = require('./routes/leads');
const adminRoutes = require('./routes/admin');
const filesRouter = require('./routes/files');
const { checkIPRestriction } = require('./middleware/ipRestriction');
const app = express();
app.use(cors());
app.use(express.json());
const { requireAuth } = require('./middleware/auth');
app.use('/api/leads',  leadRoutes);
app.use('/api/users', requireAuth, checkIPRestriction, userRoutes);
app.use('/api/teams', requireAuth, checkIPRestriction, teamRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin', adminRoutes); 
app.use('/api/notes', require('./routes/notes'));
app.use('/api/files', filesRouter);

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
);
app.get('/', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend listening on ${port}`));
